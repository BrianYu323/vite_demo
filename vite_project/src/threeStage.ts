import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface StageTheme {
  primaryColor: string;
  secondaryColor: string;
}

const PEDESTAL_TOP_Y = -0.92;
const TARGET_MODEL_SIZE = 2.05;
const PARTICLE_COUNT = 90;

/** Generate a soft radial glow texture for floating 3D energy particles */
function createParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.65)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Dispose geometries, materials, and textures of an Object3D hierarchy */
function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        }
        mat.dispose();
      }
    }
  });
}

/**
 * Interactive Three.js 3D Pokédex Stage.
 * Renders the Pokémon GLB on a liquid-glass pedestal with theme-colored rim lighting,
 * orbiting energy rings, and floating particles.
 */
export class PokedexThreeStage {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private dracoLoader: DRACOLoader;
  private gltfLoader: GLTFLoader;
  private pmremGenerator: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;

  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private underLight: THREE.PointLight;

  private pedestalGroup: THREE.Group;
  private glassDiscMat: THREE.MeshPhysicalMaterial;
  private innerRingMat: THREE.MeshBasicMaterial;
  private outerRing: THREE.Mesh;
  private outerRingMat: THREE.MeshBasicMaterial;

  private particles: THREE.Points;
  private particleMat: THREE.PointsMaterial;
  private particleSpeeds: Float32Array;
  private particleTexture: THREE.CanvasTexture;

  private modelWrapper: THREE.Group;
  private currentModel: THREE.Object3D | null = null;
  private currentModelUrl: string | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private loadToken = 0;

  private resizeObserver: ResizeObserver;
  private lastTime = performance.now();
  private elapsed = 0;
  private hasAnimations = false;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'three-stage-canvas';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.8;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 0.75, 4.4);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.4;
    this.controls.maxDistance = 7.5;
    this.controls.minPolarAngle = Math.PI * 0.14;
    this.controls.maxPolarAngle = Math.PI * 0.56;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.4;
    this.controls.target.set(0, 0.12, 0);

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.9);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    this.keyLight.position.set(3.5, 6, 4.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 16;
    this.keyLight.shadow.camera.left = -2.5;
    this.keyLight.shadow.camera.right = 2.5;
    this.keyLight.shadow.camera.top = 2.5;
    this.keyLight.shadow.camera.bottom = -2.5;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.rimLight.position.set(-4, 3, -4);
    this.scene.add(this.rimLight);

    this.underLight = new THREE.PointLight(0xffffff, 2.5, 6, 2);
    this.underLight.position.set(0, PEDESTAL_TOP_Y - 0.3, 0);
    this.scene.add(this.underLight);

    // Liquid Glass Pedestal + Glowing Rings
    this.pedestalGroup = new THREE.Group();
    this.pedestalGroup.position.y = PEDESTAL_TOP_Y - 0.08;

    this.glassDiscMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
      roughness: 0.14,
      metalness: 0.12,
      ior: 1.48,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      depthWrite: false,
    });
    const glassDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.32, 1.44, 0.12, 64),
      this.glassDiscMat
    );
    glassDisc.receiveShadow = true;
    this.pedestalGroup.add(glassDisc);

    this.innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.36, 0.018, 16, 84),
      this.innerRingMat
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.04;
    this.pedestalGroup.add(innerRing);

    this.outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
    });
    this.outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.78, 0.012, 12, 96),
      this.outerRingMat
    );
    this.outerRing.rotation.x = Math.PI / 2 + 0.14;
    this.outerRing.position.y = 0.08;
    this.pedestalGroup.add(this.outerRing);

    const shadowPlane = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 48),
      new THREE.ShadowMaterial({ opacity: 0.25 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.09;
    shadowPlane.receiveShadow = true;
    this.pedestalGroup.add(shadowPlane);

    this.scene.add(this.pedestalGroup);

    // Floating Ambient Particles
    this.particleTexture = createParticleTexture();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    this.particleSpeeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.0 + Math.random() * 2.8;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = -1.2 + Math.random() * 3.4;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      this.particleSpeeds[i] = 0.15 + Math.random() * 0.35;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleMat = new THREE.PointsMaterial({
      size: 0.12,
      map: this.particleTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(particleGeom, this.particleMat);
    this.scene.add(this.particles);

    this.modelWrapper = new THREE.Group();
    this.scene.add(this.modelWrapper);

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('/draco/');
    this.gltfLoader = new GLTFLoader()
      .setDRACOLoader(this.dracoLoader)
      .setMeshoptDecoder(MeshoptDecoder);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.handleResize();

    this.renderer.setAnimationLoop(() => this.animate());
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate(): void {
    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += delta;

    this.controls.update();

    if (this.mixer) {
      this.mixer.update(delta);
    } else if (this.currentModel && !this.hasAnimations) {
      // Gentle idle hover for static Pokémon models
      this.modelWrapper.position.y = Math.sin(this.elapsed * 1.8) * 0.045;
    }

    // Rotate outer glass energy ring
    this.outerRing.rotation.z += delta * 0.35;

    // Drift particles gently upward
    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let y = posAttr.getY(i) + this.particleSpeeds[i] * delta;
      if (y > 2.4) y = -1.2;
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
    this.particles.rotation.y += delta * 0.06;

    this.renderer.render(this.scene, this.camera);
  }

  /** Update 3D lighting, rings, and particles to match the Pokémon's type theme */
  setTheme(theme: StageTheme): void {
    const primary = new THREE.Color(theme.primaryColor);
    const secondary = new THREE.Color(theme.secondaryColor);

    this.hemiLight.groundColor.copy(primary).multiplyScalar(0.35);
    this.rimLight.color.copy(secondary).lerp(new THREE.Color(0xffffff), 0.25);
    this.underLight.color.copy(primary);
    this.glassDiscMat.color.copy(primary).lerp(new THREE.Color(0xffffff), 0.7);
    this.innerRingMat.color.copy(primary).lerp(new THREE.Color(0xffffff), 0.35);
    this.outerRingMat.color.copy(secondary).lerp(new THREE.Color(0xffffff), 0.3);
    this.particleMat.color.copy(primary).lerp(new THREE.Color(0xffffff), 0.55);
  }

  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
  }

  /** Apply or remove a 3D shiny material shift when no dedicated shiny GLB exists */
  private applyShinyShift(enabled: boolean): void {
    if (!this.currentModel) return;
    this.currentModel.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat || !('color' in mat)) continue;
        const stdMat = mat as THREE.MeshStandardMaterial;
        if (!stdMat.userData.__origColor) {
          stdMat.userData.__origColor = stdMat.color.clone();
          stdMat.userData.__origEmissive = stdMat.emissive ? stdMat.emissive.clone() : new THREE.Color(0x000000);
        }
        if (enabled) {
          const shifted = (stdMat.userData.__origColor as THREE.Color).clone();
          shifted.offsetHSL(0.14, 0.12, 0.04);
          stdMat.color.copy(shifted);
          if (stdMat.emissive) {
            stdMat.emissive.setHex(0x332200);
            stdMat.emissiveIntensity = 0.28;
          }
        } else {
          stdMat.color.copy(stdMat.userData.__origColor as THREE.Color);
          if (stdMat.emissive && stdMat.userData.__origEmissive) {
            stdMat.emissive.copy(stdMat.userData.__origEmissive as THREE.Color);
            stdMat.emissiveIntensity = 1;
          }
        }
      }
    });
  }

  /** Immediately remove and dispose the currently displayed 3D model */
  clearModel(): void {
    this.loadToken++;
    if (this.currentModel) {
      this.modelWrapper.remove(this.currentModel);
      disposeObject(this.currentModel);
      this.currentModel = null;
    }
    this.currentModelUrl = null;
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.hasAnimations = false;
    this.modelWrapper.position.set(0, 0, 0);
  }

  /** Display a 3D floating sprite card on the pedestal if a GLB model is unavailable */
  private async loadFallbackSprite(spriteUrl: string, token: number): Promise<void> {
    const texture = await new THREE.TextureLoader().loadAsync(spriteUrl);
    if (token !== this.loadToken || this.disposed) {
      texture.dispose();
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 1.85),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
      })
    );
    plane.position.set(0, PEDESTAL_TOP_Y + 0.96, 0);

    this.currentModel = plane;
    this.currentModelUrl = spriteUrl;
    this.hasAnimations = false;
    this.modelWrapper.add(plane);
    this.controls.target.set(0, plane.position.y, 0);
  }

  /** Load a GLB model onto the pedestal, normalizing scale & position */
  async loadModel(
    url: string,
    useMaterialShinyShift: boolean,
    fallbackSpriteUrl?: string
  ): Promise<void> {
    if (this.disposed) return;

    // If same GLB is already loaded, just toggle the shiny material shift
    if (url === this.currentModelUrl && this.currentModel) {
      this.applyShinyShift(useMaterialShinyShift);
      return;
    }

    // Clear the previous Pokémon's model immediately so it never lingers while switching
    this.clearModel();
    const token = ++this.loadToken;

    let gltf;
    try {
      gltf = await this.gltfLoader.loadAsync(url);
    } catch (err) {
      if (token !== this.loadToken || this.disposed) return;

      // Retry with the alternate mirror (jsDelivr <-> GitHub Raw) in case of transient CDN/network errors
      const mirrorUrl = url.includes('cdn.jsdelivr.net/gh/Pokemon-3D-api/assets@main/')
        ? url.replace(
            'https://cdn.jsdelivr.net/gh/Pokemon-3D-api/assets@main/',
            'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/'
          )
        : url.replace(
            'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/',
            'https://cdn.jsdelivr.net/gh/Pokemon-3D-api/assets@main/'
          );

      if (mirrorUrl !== url) {
        try {
          gltf = await this.gltfLoader.loadAsync(mirrorUrl);
        } catch (mirrorErr) {
          if (token !== this.loadToken || this.disposed) return;
          if (fallbackSpriteUrl) {
            await this.loadFallbackSprite(fallbackSpriteUrl, token);
            return;
          }
          throw mirrorErr;
        }
      } else {
        if (fallbackSpriteUrl) {
          await this.loadFallbackSprite(fallbackSpriteUrl, token);
          return;
        }
        throw err;
      }
    }

    if (token !== this.loadToken || this.disposed) {
      disposeObject(gltf.scene);
      return;
    }

    const model = gltf.scene;
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Normalize bounding box to sit cleanly on top of the liquid glass pedestal
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = TARGET_MODEL_SIZE / maxDim;
    model.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y += PEDESTAL_TOP_Y - scaledBox.min.y + 0.02;

    this.currentModel = model;
    this.currentModelUrl = url;
    this.modelWrapper.add(model);

    if (useMaterialShinyShift) {
      this.applyShinyShift(true);
    }

    this.hasAnimations = gltf.animations.length > 0;
    if (this.hasAnimations) {
      this.mixer = new THREE.AnimationMixer(model);
      this.mixer.clipAction(gltf.animations[0]).play();
    }

    // Smoothly frame target height
    const finalBox = new THREE.Box3().setFromObject(model);
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    this.controls.target.set(0, finalCenter.y, 0);
  }

  dispose(): void {
    this.disposed = true;
    this.loadToken++;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();

    if (this.currentModel) {
      disposeObject(this.currentModel);
      this.currentModel = null;
    }
    disposeObject(this.pedestalGroup);
    disposeObject(this.particles);
    this.particleTexture.dispose();
    this.dracoLoader.dispose();
    this.envRenderTarget.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

