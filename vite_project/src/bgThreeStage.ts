import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface FloatingPokeball {
  group: THREE.Group;
  baseY: number;
  speed: number;
  phase: number;
  rotSpeedX: number;
  rotSpeedY: number;
}

type PokeballVariant = 'poke' | 'great' | 'ultra' | 'master' | 'premier' | 'luxury';

const VARIANT_ORDER: PokeballVariant[] = [
  'poke',
  'great',
  'ultra',
  'master',
  'premier',
  'luxury',
  'poke',
  'great',
  'ultra',
];

function createSoftGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Build a multi-part 3D Pokéball mesh group for a given Pokéball variant.
 */
function createRealPokeball(
  variant: PokeballVariant,
  sharedGeoms: {
    topShell: THREE.BufferGeometry;
    bottomShell: THREE.BufferGeometry;
    innerCore: THREE.BufferGeometry;
    bezel: THREE.BufferGeometry;
    button: THREE.BufferGeometry;
    trimRing: THREE.BufferGeometry;
    bump: THREE.BufferGeometry;
    stripeArc: THREE.BufferGeometry;
  }
): THREE.Group {
  const group = new THREE.Group();

  const shellColors: Record<PokeballVariant, { top: number; bottom: number; band: number }> = {
    poke: { top: 0xef4444, bottom: 0xf8fafc, band: 0x111827 },
    great: { top: 0x2563eb, bottom: 0xf8fafc, band: 0x111827 },
    ultra: { top: 0x1f2937, bottom: 0xf8fafc, band: 0x111827 },
    master: { top: 0x7e22ce, bottom: 0xf8fafc, band: 0x111827 },
    premier: { top: 0xf8fafc, bottom: 0xf8fafc, band: 0xef4444 },
    luxury: { top: 0x18181b, bottom: 0x18181b, band: 0xf59e0b },
  };

  const palette = shellColors[variant];

  const topMat = new THREE.MeshPhysicalMaterial({
    color: palette.top,
    roughness: 0.16,
    metalness: variant === 'luxury' ? 0.35 : 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  const bottomMat = new THREE.MeshPhysicalMaterial({
    color: palette.bottom,
    roughness: 0.18,
    metalness: variant === 'luxury' ? 0.35 : 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const bandMat = new THREE.MeshStandardMaterial({
    color: palette.band,
    roughness: variant === 'luxury' ? 0.25 : 0.55,
    metalness: variant === 'luxury' ? 0.8 : 0.15,
  });

  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.28,
    roughness: 0.2,
    metalness: 0.1,
  });

  // Top & Bottom hemispheres + dark recessed core
  group.add(new THREE.Mesh(sharedGeoms.topShell, topMat));
  group.add(new THREE.Mesh(sharedGeoms.bottomShell, bottomMat));
  group.add(new THREE.Mesh(sharedGeoms.innerCore, bandMat));

  // Center button bezel & glowing release button
  const bezel = new THREE.Mesh(sharedGeoms.bezel, bandMat);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.z = 0.95;
  group.add(bezel);

  const button = new THREE.Mesh(sharedGeoms.button, buttonMat);
  button.rotation.x = Math.PI / 2;
  button.position.z = 0.975;
  group.add(button);

  // Variant-specific details
  if (variant === 'great') {
    const redMat = new THREE.MeshPhysicalMaterial({
      color: 0xef4444,
      roughness: 0.2,
      clearcoat: 0.9,
    });
    const leftStripe = new THREE.Mesh(sharedGeoms.stripeArc, redMat);
    leftStripe.rotation.set(0.55, 0.45, 0);
    const rightStripe = new THREE.Mesh(sharedGeoms.stripeArc, redMat);
    rightStripe.rotation.set(0.55, -0.45, 0);
    group.add(leftStripe, rightStripe);
  } else if (variant === 'ultra') {
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      roughness: 0.22,
      clearcoat: 0.9,
    });
    const leftStripe = new THREE.Mesh(sharedGeoms.stripeArc, goldMat);
    leftStripe.rotation.set(0.35, 0.52, 0);
    const rightStripe = new THREE.Mesh(sharedGeoms.stripeArc, goldMat);
    rightStripe.rotation.set(0.35, -0.52, 0);
    group.add(leftStripe, rightStripe);
  } else if (variant === 'master') {
    const pinkMat = new THREE.MeshPhysicalMaterial({
      color: 0xec4899,
      roughness: 0.2,
      clearcoat: 0.9,
    });
    const leftBump = new THREE.Mesh(sharedGeoms.bump, pinkMat);
    leftBump.position.set(-0.56, 0.62, 0.48);
    const rightBump = new THREE.Mesh(sharedGeoms.bump, pinkMat);
    rightBump.position.set(0.56, 0.62, 0.48);
    group.add(leftBump, rightBump);
  } else if (variant === 'luxury') {
    const redTrimMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.25,
      metalness: 0.3,
    });
    const trim = new THREE.Mesh(sharedGeoms.trimRing, redTrimMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.08;
    group.add(trim);
  }

  return group;
}

/**
 * Ambient Three.js 3D background for the main Pokédex & Games pages.
 * Renders real multi-part 3D Pokéballs and glowing particles with mouse parallax.
 */
export function initPokedexBackground3D(): () => void {
  const container = document.createElement('div');
  container.className = 'pokedex-bg-3d';
  container.setAttribute('aria-hidden', 'true');
  document.body.prepend(container);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'pokedex-bg-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 0, 12);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.9));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
  dirLight.position.set(6, 8, 8);
  scene.add(dirLight);

  const sharedGeoms = {
    topShell: new THREE.SphereGeometry(1, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.465),
    bottomShell: new THREE.SphereGeometry(1, 36, 20, 0, Math.PI * 2, Math.PI * 0.535, Math.PI * 0.465),
    innerCore: new THREE.SphereGeometry(0.972, 32, 16),
    bezel: new THREE.CylinderGeometry(0.25, 0.25, 0.1, 28),
    button: new THREE.CylinderGeometry(0.15, 0.15, 0.13, 28),
    trimRing: new THREE.TorusGeometry(0.99, 0.025, 12, 48),
    bump: new THREE.SphereGeometry(0.24, 20, 16),
    stripeArc: new THREE.TorusGeometry(0.995, 0.045, 12, 32, Math.PI * 0.42),
  };

  const pokeballs: FloatingPokeball[] = [];
  for (let i = 0; i < VARIANT_ORDER.length; i++) {
    const group = createRealPokeball(VARIANT_ORDER[i], sharedGeoms);
    const scale = 0.48 + (i % 3) * 0.22;
    group.scale.setScalar(scale);

    const x = ((i % 3) - 1) * 5.2 + (Math.random() - 0.5) * 2.2;
    const y = (Math.floor(i / 3) - 1) * 3.1 + (Math.random() - 0.5) * 1.4;
    const z = -1.5 - Math.random() * 5.5;
    group.position.set(x, y, z);
    group.rotation.set(
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 0.4
    );

    scene.add(group);
    pokeballs.push({
      group,
      baseY: y,
      speed: 0.45 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      rotSpeedX: (Math.random() - 0.5) * 0.25,
      rotSpeedY: 0.2 + Math.random() * 0.3,
    });
  }

  // Ambient drifting particles
  const particleCount = 110;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 2] = -2 - Math.random() * 10;
  }
  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pTex = createSoftGlowTexture();
  const pMat = new THREE.PointsMaterial({
    size: 0.16,
    map: pTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeom, pMat);
  scene.add(particles);

  let targetCamX = 0;
  let targetCamY = 0;
  const onPointerMove = (e: PointerEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetCamX = nx * 0.55;
    targetCamY = -ny * 0.35;
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener('resize', onResize);

  let last = performance.now();
  let elapsed = 0;

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;

    camera.position.x += (targetCamX - camera.position.x) * 0.04;
    camera.position.y += (targetCamY - camera.position.y) * 0.04;
    camera.lookAt(0, 0, -2);

    for (const ball of pokeballs) {
      ball.group.position.y = ball.baseY + Math.sin(elapsed * ball.speed + ball.phase) * 0.35;
      ball.group.rotation.x += ball.rotSpeedX * dt;
      ball.group.rotation.y += ball.rotSpeedY * dt;
    }

    particles.rotation.y += dt * 0.015;
    renderer.render(scene, camera);
  });

  return () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('resize', onResize);
    Object.values(sharedGeoms).forEach((g) => g.dispose());
    pGeom.dispose();
    pTex.dispose();
    pMat.dispose();
    envTarget.dispose();
    pmrem.dispose();
    renderer.dispose();
    container.remove();
  };
}
