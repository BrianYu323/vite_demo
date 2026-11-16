import {
  getPokemonSpriteUrl,
  resourceId,
  type ChainLink,
  type Pokemon,
  type PokemonForm,
  type PokemonSpecies,
} from 'pokenode-ts';
import {
  UI_TEXT,
  getFormCategoryKey,
  getLanguage,
  getLocalizedFormTag,
  getLocalizedStatName,
  getLocalizedTypeName,
  onLanguageChange,
  resolveLocalizedFormName,
  resolveLocalizedName,
  type SupportedLanguage,
} from './i18n';
import { api } from './pokedex';
import { PokedexThreeStage } from './threeStage';

/**
 * Pokémon 3D detail page with Liquid Glass UI.
 * - Opens when a `.pokemon-card` is clicked.
 * - Renders an interactive Three.js 3D stage with theme-colored background, liquid-glass pedestal,
 *   orbiting rings, and floating energy particles.
 * - Displays Liquid Glass cards for Types, possible Gender, Moves, Base Stats, and Evolution Chains.
 */

const MODEL_OPT_BASE_URL =
  'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt';

/** Cache whether a specific .glb URL exists in Pokemon-3D-api/assets */
const glbUrlExistsCache = new Map<string, boolean>();

/** Number of moves displayed in the "Moves" list */
const MOVES_LIMIT = 6;

/** Stat value that fills the whole bar */
const STAT_BAR_MAX = 150;

/** Banner colors for each primary type */
const TYPE_BANNER_COLORS: Record<string, string> = {
  normal: '#a8a878',
  fire: '#f08030',
  water: '#6890f0',
  grass: '#5dbb63',
  electric: '#f8d030',
  ice: '#98d8d8',
  fighting: '#c03028',
  poison: '#a040a0',
  ground: '#e0c068',
  flying: '#a890f0',
  psychic: '#f85888',
  bug: '#a8b820',
  rock: '#b8a038',
  ghost: '#705898',
  dragon: '#7038f8',
  dark: '#705848',
  steel: '#b8b8d0',
  fairy: '#ee99ac',
};

/** Small icon shown inside each type badge */
const TYPE_ICONS: Record<string, string> = {
  normal: '⚪',
  fire: '🔥',
  water: '💧',
  grass: '🍃',
  electric: '⚡',
  ice: '❄️',
  fighting: '🥊',
  poison: '☠️',
  ground: '⛰️',
  flying: '🪽',
  psychic: '🔮',
  bug: '🐛',
  rock: '🪨',
  ghost: '👻',
  dragon: '🐉',
  dark: '🌙',
  steel: '⚙️',
  fairy: '✨',
};

interface EvolutionStageEntry {
  /** Exact Pokemon ID (e.g. 3 for Venusaur, 10033 for Mega Venusaur, 10091 for Alolan Rattata) */
  pokemonId: number;
  /** Base PokemonSpecies ID (e.g. 3 for Venusaur, 19 for Rattata) */
  speciesId: number;
  /** Pokemon or form slug (e.g. "venusaur", "venusaur-mega", "rattata-alola") */
  slug: string;
  species: PokemonSpecies;
  form?: PokemonForm | null;
}

interface DetailData {
  pokemon: Pokemon;
  species: PokemonSpecies;
  form: PokemonForm | null;
  moveNames: string[];
  mainEvolutionStages: EvolutionStageEntry[][];
  regionalEvolutionChains: EvolutionStageEntry[][][];
  modelRegularUrl: string;
  modelShinyUrl: string | null;
}

let overlay: HTMLElement | null = null;
let stageContainer: HTMLElement | null = null;
let uiLayer: HTMLElement | null = null;
let threeStage: PokedexThreeStage | null = null;
let browseIds: number[] = [];
let currentId: number | null = null;
let currentData: DetailData | null = null;
let isShiny = false;
let isAutoRotate = true;
let requestToken = 0;

/** Lazily create or return the Three.js stage inside the overlay */
function ensureThreeStage(): PokedexThreeStage {
  ensureOverlay();
  if (!threeStage && stageContainer) {
    threeStage = new PokedexThreeStage(stageContainer);
    threeStage.setAutoRotate(isAutoRotate);
  }
  return threeStage!;
}

/** Check if a specific .glb URL exists in Pokemon-3D-api/assets */
async function checkGlbUrlExists(url: string): Promise<boolean> {
  const cached = glbUrlExistsCache.get(url);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(url, { method: 'HEAD' });
    const exists = res.ok;
    glbUrlExistsCache.set(url, exists);
    return exists;
  } catch {
    glbUrlExistsCache.set(url, false);
    return false;
  }
}

/** Map a Pokémon / form slug to its Pokemon-3D-api folder names */
function getModelFoldersForSlug(slug: string): { regularFolder: string; shinyFolder: string | null } {
  const category = getFormCategoryKey(slug);
  switch (category) {
    case 'mega':
      return { regularFolder: 'mega', shinyFolder: 'megaShiny' };
    case 'mega-x':
      return { regularFolder: 'x', shinyFolder: 'sx' };
    case 'mega-y':
      return { regularFolder: 'y', shinyFolder: 'sy' };
    case 'gmax':
      return { regularFolder: 'gmax', shinyFolder: null };
    case 'primal':
      return { regularFolder: 'primal', shinyFolder: null };
    case 'origin':
      return { regularFolder: 'origin', shinyFolder: null };
    case 'alola':
      return { regularFolder: 'alolan', shinyFolder: null };
    case 'galar':
      return { regularFolder: 'galar', shinyFolder: null };
    case 'hisui':
      return { regularFolder: 'hisuian', shinyFolder: null };
    default:
      return { regularFolder: 'regular', shinyFolder: 'shiny' };
  }
}

/** Resolve the best available 3D regular and shiny .glb URLs for a Pokémon or special form */
async function resolveModelUrls(
  speciesId: number,
  slug: string
): Promise<{ modelRegularUrl: string; modelShinyUrl: string | null }> {
  const fallbackRegular = `${MODEL_OPT_BASE_URL}/regular/${speciesId}.glb`;
  const { regularFolder, shinyFolder } = getModelFoldersForSlug(slug);

  let modelRegularUrl = fallbackRegular;
  if (regularFolder !== 'regular') {
    const candidateRegular = `${MODEL_OPT_BASE_URL}/${regularFolder}/${speciesId}.glb`;
    if (await checkGlbUrlExists(candidateRegular)) {
      modelRegularUrl = candidateRegular;
    }
  }

  let modelShinyUrl: string | null = null;
  if (shinyFolder) {
    const candidateShiny = `${MODEL_OPT_BASE_URL}/${shinyFolder}/${speciesId}.glb`;
    if (await checkGlbUrlExists(candidateShiny)) {
      modelShinyUrl = candidateShiny;
    }
  }

  return { modelRegularUrl, modelShinyUrl };
}

/** Format gender badges HTML from species.gender_rate (-1 = genderless, 0 = male only, 8 = female only, 1..7 = both) */
function renderGenderBadgesHtml(genderRate: number, lang: SupportedLanguage): string {
  const t = UI_TEXT[lang];
  if (genderRate === -1) {
    return `<span class="gender-pill gender-none">${t.genderlessLabel}</span>`;
  }
  if (genderRate === 0) {
    return `<span class="gender-pill gender-male">♂ ${t.maleLabel}</span>`;
  }
  if (genderRate === 8) {
    return `<span class="gender-pill gender-female">♀ ${t.femaleLabel}</span>`;
  }
  return `
    <span class="gender-pill gender-male">♂ ${t.maleLabel}</span>
    <span class="gender-pill gender-female">♀ ${t.femaleLabel}</span>
  `;
}

/** Compact gender symbols for evolution chain cards */
function renderCompactGenderHtml(genderRate: number, lang: SupportedLanguage): string {
  const t = UI_TEXT[lang];
  if (genderRate === -1) {
    return `<span class="evo-gender-tag gender-none">${t.genderlessLabel}</span>`;
  }
  if (genderRate === 0) {
    return `<span class="evo-gender-tag gender-male" title="${t.maleLabel}">♂</span>`;
  }
  if (genderRate === 8) {
    return `<span class="evo-gender-tag gender-female" title="${t.femaleLabel}">♀</span>`;
  }
  return `
    <span class="evo-gender-tag gender-male" title="${t.maleLabel}">♂</span>
    <span class="evo-gender-tag gender-female" title="${t.femaleLabel}">♀</span>
  `;
}

function isRegionalSlug(slug?: string | null): boolean {
  if (!slug) return false;
  const cat = getFormCategoryKey(slug);
  return cat === 'alola' || cat === 'galar' || cat === 'hisui' || cat === 'paldea';
}

function isSpecialBattleSlug(slug: string): boolean {
  const cat = getFormCategoryKey(slug);
  return (
    cat === 'mega' ||
    cat === 'mega-x' ||
    cat === 'mega-y' ||
    cat === 'gmax' ||
    cat === 'primal' ||
    cat === 'origin'
  );
}

/** Collect all unique species IDs in an EvolutionChain tree */
function collectChainSpeciesIds(root: ChainLink): number[] {
  const ids = new Set<number>();
  const stack: ChainLink[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    ids.add(resourceId(node.species));
    for (const child of node.evolves_to) {
      stack.push(child);
    }
  }
  return Array.from(ids);
}

/** Resolve an EvolutionStageEntry for any species or form slug */
async function buildStageEntry(
  slug: string,
  species: PokemonSpecies
): Promise<EvolutionStageEntry> {
  if (slug === species.name) {
    return {
      pokemonId: species.id,
      speciesId: species.id,
      slug,
      species,
      form: null,
    };
  }

  const variety = species.varieties.find((v) => v.pokemon.name === slug);
  const form = await api.pokemon.getPokemonFormByName(slug).catch(() => null);
  const pokemonId = variety
    ? resourceId(variety.pokemon)
    : form
      ? resourceId(form.pokemon)
      : species.id;

  return {
    pokemonId,
    speciesId: species.id,
    slug,
    species,
    form,
  };
}

/**
 * Build both the Main Evolution Chain (with Mega / G-Max / Primal stage)
 * and Regional / Alternate Form Evolution Chains from `/evolution-chain/{id}/` and `species.varieties`.
 */
async function buildEvolutionChains(
  root: ChainLink,
  currentSpecies: PokemonSpecies
): Promise<{
  mainEvolutionStages: EvolutionStageEntry[][];
  regionalEvolutionChains: EvolutionStageEntry[][][];
}> {
  const speciesIds = collectChainSpeciesIds(root);
  const speciesList = await Promise.all(
    speciesIds.map((sid) =>
      sid === currentSpecies.id ? currentSpecies : api.pokemon.getPokemonSpeciesById(sid)
    )
  );

  const speciesById = new Map<number, PokemonSpecies>();
  const speciesByName = new Map<string, PokemonSpecies>();
  for (const sp of speciesList) {
    speciesById.set(sp.id, sp);
    speciesByName.set(sp.name, sp);
  }

  const resolveSpeciesForSlug = (slug: string, fallback: PokemonSpecies): PokemonSpecies => {
    const exact = speciesByName.get(slug);
    if (exact) return exact;
    for (const sp of speciesList) {
      if (sp.varieties.some((v) => v.pokemon.name === slug)) {
        return sp;
      }
    }
    return fallback;
  };

  // 1. Main Evolution Chain stages (normal evolution links + Mega / G-Max / Primal stage)
  const mainStagesRaw: Array<Array<{ slug: string; species: PokemonSpecies }>> = [];
  let currentLevel: ChainLink[] = [root];

  while (currentLevel.length > 0) {
    mainStagesRaw.push(
      currentLevel.map((link) => {
        const sp = speciesById.get(resourceId(link.species)) ?? currentSpecies;
        return { slug: sp.name, species: sp };
      })
    );

    currentLevel = currentLevel.flatMap((link) =>
      link.evolves_to.filter(
        (child) =>
          child.evolution_details.length === 0 ||
          child.evolution_details.some(
            (d) =>
              !isRegionalSlug(d.required_pokemon_form?.name) &&
              !isRegionalSlug(d.evolved_pokemon_form?.name) &&
              !d.region
          )
      )
    );
  }

  // Append Mega / G-Max / Primal / Origin forms as an extra stage at the end of the main chain
  const specialBattleForms: Array<{ slug: string; species: PokemonSpecies }> = [];
  for (const stage of mainStagesRaw) {
    for (const item of stage) {
      for (const v of item.species.varieties) {
        if (!v.is_default && isSpecialBattleSlug(v.pokemon.name)) {
          specialBattleForms.push({ slug: v.pokemon.name, species: item.species });
        }
      }
    }
  }
  if (specialBattleForms.length > 0) {
    mainStagesRaw.push(specialBattleForms);
  }

  const mainEvolutionStages = await Promise.all(
    mainStagesRaw.map((stage) =>
      Promise.all(stage.map((item) => buildStageEntry(item.slug, item.species)))
    )
  );

  // 2. Regional & Form-Specific Evolution Chains from evolution_details + varieties
  const childrenMap = new Map<string, Set<string>>();
  const incomingCount = new Map<string, number>();
  const slugToSpecies = new Map<string, PokemonSpecies>();

  const registerNode = (slug: string, sp: PokemonSpecies) => {
    if (!slugToSpecies.has(slug)) slugToSpecies.set(slug, sp);
    if (!childrenMap.has(slug)) childrenMap.set(slug, new Set());
    if (!incomingCount.has(slug)) incomingCount.set(slug, 0);
  };

  const addEdge = (fromSlug: string, fromSp: PokemonSpecies, toSlug: string, toSp: PokemonSpecies) => {
    registerNode(fromSlug, fromSp);
    registerNode(toSlug, toSp);
    const children = childrenMap.get(fromSlug)!;
    if (!children.has(toSlug)) {
      children.add(toSlug);
      incomingCount.set(toSlug, (incomingCount.get(toSlug) ?? 0) + 1);
    }
  };

  const walkRegionalEdges = (parentLink: ChainLink) => {
    const parentSp = speciesById.get(resourceId(parentLink.species)) ?? currentSpecies;

    for (const childLink of parentLink.evolves_to) {
      const childSp = speciesById.get(resourceId(childLink.species)) ?? currentSpecies;

      for (const detail of childLink.evolution_details) {
        const reqSlug = detail.required_pokemon_form?.name;
        const evoSlug = detail.evolved_pokemon_form?.name;
        const hasRegional =
          isRegionalSlug(reqSlug) || isRegionalSlug(evoSlug) || detail.region !== null;

        if (hasRegional) {
          const fromSlug = reqSlug ?? parentSp.name;
          const toSlug = evoSlug ?? childSp.name;
          addEdge(
            fromSlug,
            resolveSpeciesForSlug(fromSlug, parentSp),
            toSlug,
            resolveSpeciesForSlug(toSlug, childSp)
          );
        }
      }

      walkRegionalEdges(childLink);
    }
  };
  walkRegionalEdges(root);

  // Also include any regional varieties in species.varieties not already in the graph
  for (const sp of speciesList) {
    for (const v of sp.varieties) {
      if (!v.is_default && isRegionalSlug(v.pokemon.name) && !slugToSpecies.has(v.pokemon.name)) {
        registerNode(v.pokemon.name, sp);
      }
    }
  }

  // Convert regional roots into stage arrays
  const regionalRoots = Array.from(slugToSpecies.keys()).filter(
    (slug) => (incomingCount.get(slug) ?? 0) === 0
  );

  const regionalEvolutionChains: EvolutionStageEntry[][][] = [];
  for (const rootSlug of regionalRoots) {
    const stagesRaw: string[][] = [];
    let level = [rootSlug];
    const visited = new Set<string>(level);

    while (level.length > 0) {
      stagesRaw.push(level);
      const nextLevel: string[] = [];
      for (const s of level) {
        for (const child of childrenMap.get(s) ?? []) {
          if (!visited.has(child)) {
            visited.add(child);
            nextLevel.push(child);
          }
        }
      }
      level = nextLevel;
    }

    const resolvedStages = await Promise.all(
      stagesRaw.map((stage) =>
        Promise.all(
          stage.map((slug) => buildStageEntry(slug, slugToSpecies.get(slug) ?? currentSpecies))
        )
      )
    );
    regionalEvolutionChains.push(resolvedStages);
  }

  return { mainEvolutionStages, regionalEvolutionChains };
}

/** Create the overlay container once with a persistent Three.js stage + Liquid Glass UI layer */
function ensureOverlay(): HTMLElement {
  if (overlay) return overlay;

  overlay = document.createElement('section');
  overlay.id = 'pokemon-detail';
  overlay.className = 'detail-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  stageContainer = document.createElement('div');
  stageContainer.className = 'detail-three-stage';
  overlay.appendChild(stageContainer);

  uiLayer = document.createElement('div');
  uiLayer.className = 'detail-ui-layer';
  overlay.appendChild(uiLayer);

  document.body.appendChild(overlay);

  // Event delegation for close / prev / next / shiny / rotate / evolution card clicks
  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="close"]')) {
      closePokemonDetail();
    } else if (target.closest('[data-action="prev"]')) {
      navigate(-1);
    } else if (target.closest('[data-action="next"]')) {
      navigate(1);
    } else if (target.closest('[data-action="toggle-shiny"]')) {
      toggleShinyForm();
    } else if (target.closest('[data-action="toggle-rotate"]')) {
      toggleAutoRotate();
    } else {
      const evoCard = target.closest<HTMLElement>('[data-evo-id]');
      if (evoCard) {
        const evoPokemonId = Number(evoCard.getAttribute('data-evo-id'));
        const evoSpeciesId = Number(evoCard.getAttribute('data-evo-species-id')) || evoPokemonId;
        const evoSlug = evoCard.getAttribute('data-evo-slug') || undefined;
        if (!Number.isNaN(evoPokemonId) && evoPokemonId > 0 && evoPokemonId !== currentId) {
          showPokemon(evoPokemonId, evoSpeciesId, evoSlug);
        }
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!overlay?.classList.contains('is-open')) return;
    if (e.key === 'Escape') closePokemonDetail();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  return overlay;
}

/** Toggle 3D camera auto-rotation */
function toggleAutoRotate(): void {
  if (!overlay) return;
  isAutoRotate = !isAutoRotate;
  threeStage?.setAutoRotate(isAutoRotate);
  const rotateBtn = overlay.querySelector<HTMLButtonElement>('[data-action="toggle-rotate"]');
  rotateBtn?.classList.toggle('is-active', isAutoRotate);
  rotateBtn?.setAttribute('aria-pressed', String(isAutoRotate));
}

/** Toggle between regular and shiny 3D model and evolution chain sprites */
async function toggleShinyForm(): Promise<void> {
  if (!currentData || !overlay) return;
  isShiny = !isShiny;

  const { modelRegularUrl, modelShinyUrl } = currentData;
  const shinyBtn = overlay.querySelector<HTMLButtonElement>('[data-action="toggle-shiny"]');
  shinyBtn?.classList.toggle('is-active', isShiny);
  shinyBtn?.setAttribute('aria-pressed', String(isShiny));

  const targetUrl = isShiny && modelShinyUrl ? modelShinyUrl : modelRegularUrl;
  const useShift = isShiny && !modelShinyUrl;
  const fallbackSprite = getPokemonSpriteUrl(currentData.pokemon.id, {
    variant: 'official-artwork',
    shiny: isShiny,
  });
  await threeStage?.loadModel(targetUrl, useShift, fallbackSprite).catch((err) => {
    console.error('Failed to switch shiny 3D model:', err);
  });

  // Update evolution chain sprites to match regular/shiny state
  overlay.querySelectorAll<HTMLImageElement>('.evo-card-img').forEach((img) => {
    const evoId = Number(img.getAttribute('data-evo-img-id'));
    if (!Number.isNaN(evoId) && evoId > 0) {
      img.src = getPokemonSpriteUrl(evoId, {
        variant: 'official-artwork',
        shiny: isShiny,
      });
    }
  });
}

/** Fetch Pokémon, species, localized moves, full evolution chain, and 3D model URLs */
async function fetchDetail(
  pokemonId: number,
  speciesIdHint?: number,
  slugHint?: string
): Promise<DetailData> {
  const pokemon = await api.pokemon.getPokemonById(pokemonId);
  const resolvedSpeciesId = speciesIdHint ?? resourceId(pokemon.species);
  const resolvedSlug = slugHint ?? pokemon.name;

  const [species, form, modelUrls] = await Promise.all([
    api.pokemon.getPokemonSpeciesById(resolvedSpeciesId),
    resolvedSlug !== pokemon.species.name
      ? api.pokemon.getPokemonFormByName(resolvedSlug).catch(() => null)
      : Promise.resolve(null),
    resolveModelUrls(resolvedSpeciesId, resolvedSlug),
  ]);

  const moveRefs = pokemon.moves.slice(0, MOVES_LIMIT).map((m) => m.move.name);
  const evoChainId = resourceId(species.evolution_chain);

  const [moves, evoChain] = await Promise.all([
    Promise.all(moveRefs.map((name) => api.move.getMoveByName(name).catch(() => null))),
    api.evolution.getEvolutionChainById(evoChainId).catch(() => null),
  ]);

  let mainEvolutionStages: EvolutionStageEntry[][] = [];
  let regionalEvolutionChains: EvolutionStageEntry[][][] = [];
  if (evoChain) {
    const chains = await buildEvolutionChains(evoChain.chain, species);
    mainEvolutionStages = chains.mainEvolutionStages;
    regionalEvolutionChains = chains.regionalEvolutionChains;
  }

  return {
    pokemon,
    species,
    form,
    moveNames: moveRefs.map((slug, i) => {
      const move = moves[i];
      return move ? resolveLocalizedName(move.names, slug, getLanguage()) : slug;
    }),
    mainEvolutionStages,
    regionalEvolutionChains,
    modelRegularUrl: modelUrls.modelRegularUrl,
    modelShinyUrl: modelUrls.modelShinyUrl,
  };
}

/** Re-resolve move names for a language change (moves are cached by pokenode-ts) */
async function relocalizeMoves(data: DetailData, lang: SupportedLanguage): Promise<string[]> {
  const slugs = data.pokemon.moves.slice(0, MOVES_LIMIT).map((m) => m.move.name);
  const moves = await Promise.all(
    slugs.map((name) => api.move.getMoveByName(name).catch(() => null))
  );
  return slugs.map((slug, i) => {
    const move = moves[i];
    return move ? resolveLocalizedName(move.names, slug, lang) : slug;
  });
}

function renderLoading(): void {
  ensureOverlay();
  if (!uiLayer) return;
  const t = UI_TEXT[getLanguage()];
  uiLayer.innerHTML = `
    <div class="detail-page detail-loading-state">
      <button type="button" class="liquid-glass-btn detail-close" data-action="close" aria-label="${t.close}">✕</button>
      <div class="liquid-glass-card detail-loading-pill">${t.loadingDetail}</div>
    </div>
  `;
}

function renderEvolutionRowHtml(
  stages: EvolutionStageEntry[][],
  currentPokemonId: number,
  lang: SupportedLanguage
): string {
  return stages
    .map((stage, stageIdx) => {
      const cardsHtml = stage
        .map((entry) => {
          const evoName = resolveLocalizedFormName(
            entry.species.names,
            entry.form?.names,
            entry.form?.form_names,
            entry.slug,
            lang
          );
          const formTag = getLocalizedFormTag(entry.slug, lang);
          const formCategory = getFormCategoryKey(entry.slug);
          const formBadgeHtml = formTag
            ? `<span class="evo-form-badge evo-badge-${formCategory ?? 'special'}">${formTag}</span>`
            : '';

          const evoIdFormatted = `#${entry.speciesId.toString().padStart(3, '0')}`;
          const evoSprite = getPokemonSpriteUrl(entry.pokemonId, {
            variant: 'official-artwork',
            shiny: isShiny,
          });
          const isCurrent = entry.pokemonId === currentPokemonId;
          const evoGenderHtml = renderCompactGenderHtml(entry.species.gender_rate, lang);

          return `
            <button
              type="button"
              class="evo-card${isCurrent ? ' is-current' : ''}"
              data-evo-id="${entry.pokemonId}"
              data-evo-species-id="${entry.speciesId}"
              data-evo-slug="${entry.slug}"
            >
              ${formBadgeHtml}
              <div class="evo-img-wrap">
                <img class="evo-card-img" data-evo-img-id="${entry.pokemonId}" src="${evoSprite}" alt="${evoName}" loading="lazy" />
              </div>
              <span class="evo-id">${evoIdFormatted}</span>
              <span class="evo-name">${evoName}</span>
              <div class="evo-genders">${evoGenderHtml}</div>
            </button>
          `;
        })
        .join('');

      const arrowHtml =
        stageIdx < stages.length - 1
          ? '<div class="evo-arrow" aria-hidden="true">→</div>'
          : '';

      return `
        <div class="evo-stage">${cardsHtml}</div>
        ${arrowHtml}
      `;
    })
    .join('');
}

function renderDetail(data: DetailData, lang: SupportedLanguage = getLanguage()): void {
  const el = ensureOverlay();
  if (!uiLayer) return;
  const t = UI_TEXT[lang];
  const {
    pokemon,
    species,
    form,
    moveNames,
    mainEvolutionStages,
    regionalEvolutionChains,
  } = data;

  const primaryType = pokemon.types[0]?.type.name ?? 'normal';
  const secondaryType = pokemon.types[1]?.type.name ?? primaryType;
  const primaryColor = TYPE_BANNER_COLORS[primaryType] ?? '#a8a878';
  const secondaryColor = TYPE_BANNER_COLORS[secondaryType] ?? primaryColor;

  el.style.setProperty('--theme-primary', primaryColor);
  el.style.setProperty('--theme-secondary', secondaryColor);
  el.style.setProperty('--banner-color', primaryColor);

  const name = resolveLocalizedFormName(
    species.names,
    form?.names,
    form?.form_names,
    pokemon.name,
    lang
  );
  const formattedId = `#${species.id.toString().padStart(3, '0')}`;

  const index = browseIds.indexOf(species.id);
  const hasPrev = index > 0;
  const hasNext = index !== -1 && index < browseIds.length - 1;

  const typesHtml = pokemon.types
    .map(
      (slot) => `
        <span class="detail-type type-${slot.type.name}">
          <span class="detail-type-icon">${TYPE_ICONS[slot.type.name] ?? '●'}</span>
          ${getLocalizedTypeName(slot.type.name, lang)}
        </span>`
    )
    .join('');

  const genderHtml = renderGenderBadgesHtml(species.gender_rate, lang);
  const movesHtml = moveNames.map((move) => `<li>${move}</li>`).join('');

  const statsHtml = pokemon.stats
    .map((s) => {
      const percent = Math.min(100, (s.base_stat / STAT_BAR_MAX) * 100);
      return `
        <div class="stat-row">
          <span class="stat-name">${getLocalizedStatName(s.stat.name, lang)}</span>
          <span class="stat-value">${s.base_stat}</span>
          <div class="stat-bar"><div class="stat-bar-fill" style="width: ${percent}%"></div></div>
        </div>`;
    })
    .join('');

  const mainChainHtml = renderEvolutionRowHtml(mainEvolutionStages, pokemon.id, lang);

  const regionalChainsHtml =
    regionalEvolutionChains.length > 0
      ? `
        <h4 class="evo-sub-heading">${t.regionalFormsLabel}</h4>
        <div class="evo-regional-chains">
          ${regionalEvolutionChains
            .map(
              (chain) =>
                `<div class="evo-chain-list evo-regional-row">${renderEvolutionRowHtml(chain, pokemon.id, lang)}</div>`
            )
            .join('')}
        </div>
      `
      : '';

  uiLayer.innerHTML = `
    <div class="detail-page">
      <!-- Top Floating Liquid Glass Header Bar -->
      <header class="detail-glass-header">
        <div class="liquid-glass-pill detail-identity-pill">
          <span class="detail-id">${formattedId}</span>
          <h2 class="detail-name">${name}</h2>
        </div>

        <div class="detail-header-actions">
          <button
            type="button"
            class="liquid-glass-btn detail-shiny-btn${isShiny ? ' is-active' : ''}"
            data-action="toggle-shiny"
            aria-pressed="${isShiny}"
            title="${t.shinyLabel}"
          >
            ✨ <span>${t.shinyLabel}</span>
          </button>

          <button
            type="button"
            class="liquid-glass-btn detail-rotate-btn${isAutoRotate ? ' is-active' : ''}"
            data-action="toggle-rotate"
            aria-pressed="${isAutoRotate}"
            title="${t.rotateLabel}"
          >
            ↻ <span>${t.rotateLabel}</span>
          </button>

          <button type="button" class="liquid-glass-btn detail-close" data-action="close" aria-label="${t.close}">✕</button>
        </div>
      </header>

      <!-- Side Prev / Next Liquid Glass Orbs -->
      <button type="button" class="liquid-glass-btn detail-nav detail-prev" data-action="prev" aria-label="${t.prev}" ${hasPrev ? '' : 'disabled'}>
        <span aria-hidden="true">‹</span>
      </button>
      <button type="button" class="liquid-glass-btn detail-nav detail-next" data-action="next" aria-label="${t.next}" ${hasNext ? '' : 'disabled'}>
        <span aria-hidden="true">›</span>
      </button>

      <div class="detail-body">
        <!-- Central transparent window over the interactive Three.js 3D Pokémon -->
        <div class="detail-stage-spacer" aria-hidden="true"></div>

        <!-- Left Liquid Glass Card: Types + Gender + Moves -->
        <div class="liquid-glass-card detail-left">
          <h3 class="detail-heading">${t.types}</h3>
          <div class="detail-types">${typesHtml}</div>

          <h3 class="detail-heading">${t.genderLabel}</h3>
          <div class="detail-genders">${genderHtml}</div>

          <h3 class="detail-heading">${t.movesLabel}</h3>
          <ul class="detail-moves">${movesHtml}</ul>
        </div>

        <!-- Right Liquid Glass Card: Base Stats -->
        <div class="liquid-glass-card detail-right">
          <h3 class="detail-heading">${t.statsLabel}</h3>
          <div class="detail-stats">${statsHtml}</div>
        </div>

        <!-- Bottom Liquid Glass Dock: Evolution Chain (Main + Mega/G-Max + Regional Forms) -->
        <div class="liquid-glass-card detail-evolution">
          <h3 class="detail-heading">${t.evolutionChainLabel}</h3>
          <div class="evo-chain-list">${mainChainHtml}</div>
          ${regionalChainsHtml}
        </div>
      </div>
    </div>
  `;
}

async function showPokemon(
  pokemonId: number,
  speciesIdHint?: number,
  slugHint?: string
): Promise<void> {
  const token = ++requestToken;
  currentId = pokemonId;

  const stage = ensureThreeStage();
  stage.clearModel();
  if (!currentData) {
    renderLoading();
  } else {
    uiLayer?.querySelector('.detail-page')?.classList.add('is-switching');
  }

  try {
    const data = await fetchDetail(pokemonId, speciesIdHint, slugHint);
    if (token !== requestToken) return;
    currentData = data;

    const primaryType = data.pokemon.types[0]?.type.name ?? 'normal';
    const secondaryType = data.pokemon.types[1]?.type.name ?? primaryType;
    stage.setTheme({
      primaryColor: TYPE_BANNER_COLORS[primaryType] ?? '#a8a878',
      secondaryColor: TYPE_BANNER_COLORS[secondaryType] ?? TYPE_BANNER_COLORS[primaryType] ?? '#a8a878',
    });

    renderDetail(data);

    const targetUrl = isShiny && data.modelShinyUrl ? data.modelShinyUrl : data.modelRegularUrl;
    const useShift = isShiny && !data.modelShinyUrl;
    const fallbackSprite = getPokemonSpriteUrl(data.pokemon.id, {
      variant: 'official-artwork',
      shiny: isShiny,
    });
    stage.loadModel(targetUrl, useShift, fallbackSprite).catch((modelErr) => {
      console.warn('3D model failed to load:', modelErr);
    });
  } catch (err) {
    if (token !== requestToken) return;
    console.error('Failed to load Pokémon detail:', err);
    ensureOverlay();
    if (uiLayer) {
      uiLayer.innerHTML = `
        <div class="detail-page detail-loading-state">
          <button type="button" class="liquid-glass-btn detail-close" data-action="close" aria-label="${UI_TEXT[getLanguage()].close}">✕</button>
          <div class="liquid-glass-card detail-loading-pill error">${UI_TEXT[getLanguage()].errorLoad}</div>
        </div>
      `;
    }
  }
}

function navigate(step: number): void {
  const baseSpeciesId = currentData?.species.id ?? currentId;
  if (baseSpeciesId === null) return;
  const index = browseIds.indexOf(baseSpeciesId);
  const nextId = browseIds[index + step];
  if (index === -1 || nextId === undefined) return;
  showPokemon(nextId);
}

/**
 * Open the 3D Liquid Glass detail page for a Pokémon.
 * @param id National Pokédex ID of the selected Pokémon.
 * @param ids Ordered list of IDs used by the Prev / Next arrows.
 */
export function openPokemonDetail(id: number, ids: number[] = []): void {
  browseIds = ids.length > 0 ? ids : [id];
  currentData = null;
  isShiny = false;
  isAutoRotate = true;

  const el = ensureOverlay();
  el.classList.add('is-open');
  document.body.classList.add('detail-open');

  showPokemon(id);
}

export function closePokemonDetail(): void {
  requestToken++;
  currentId = null;
  currentData = null;
  if (threeStage) {
    threeStage.dispose();
    threeStage = null;
  }
  if (overlay) {
    overlay.classList.remove('is-open');
  }
  if (uiLayer) {
    uiLayer.innerHTML = '';
  }
  document.body.classList.remove('detail-open');
}

// Re-render the open detail page when the language changes
onLanguageChange(async (lang) => {
  if (!currentData || !overlay?.classList.contains('is-open')) return;
  const data = currentData;
  data.moveNames = await relocalizeMoves(data, lang);
  if (currentData === data && getLanguage() === lang) {
    renderDetail(data, lang);
  }
});
