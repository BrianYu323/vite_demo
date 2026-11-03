import {
  GENERATIONS,
  MainClient,
  resourceId,
  type Pokemon,
  type PokemonSpecies,
} from 'pokenode-ts';
import { setGamesPageActive } from './games';
import {
  UI_TEXT,
  getLanguage,
  getLocalizedRegionName,
  getLocalizedTypeName,
  onLanguageChange,
  resolveLocalizedName,
  type SupportedLanguage,
} from './i18n';

export const api = new MainClient();

/** Track active load request so switching generations cancels stale renders */
let currentRequestId = 0;
let activeGenerationId: number | string = GENERATIONS.GENERATION_I;
let activeRegionSlug = 'kanto';
let activeSpeciesCount = 0;
let isPokedexActive = true;

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Update the region header text using the active language */
function updateRegionHeaderDOM(lang: SupportedLanguage = getLanguage()): void {
  const regionHeader = document.getElementById('generation-header');
  if (!regionHeader || !activeRegionSlug) return;

  const regionName = getLocalizedRegionName(activeRegionSlug, undefined, lang);
  const unit = UI_TEXT[lang].pokemonUnit;

  regionHeader.innerHTML = `
    <div class="region-header-content">
      <h2 class="region-title">${regionName}</h2>
      <span class="generation-badge">${activeSpeciesCount} ${unit}</span>
    </div>
  `;
}

/** Render a single Pokémon card */
function renderCard(
  pokemon: Pokemon,
  species: PokemonSpecies | null,
  lang: SupportedLanguage
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'pokemon-card';
  card.setAttribute('data-pokemon-id', String(pokemon.id));
  card.setAttribute('data-default-name', pokemon.name);

  const sprite =
    pokemon.sprites.other?.['official-artwork']?.front_default ||
    pokemon.sprites.front_default ||
    '';

  const localizedPokemonName = species
    ? resolveLocalizedName(species.names, pokemon.name, lang)
    : capitalize(pokemon.name);

  const typesHtml = pokemon.types
    .map(
      (t) =>
        `<span class="type-badge type-${t.type.name}" data-type="${t.type.name}">${getLocalizedTypeName(t.type.name, lang)}</span>`
    )
    .join('');

  const formattedId = `#${pokemon.id.toString().padStart(3, '0')}`;

  card.innerHTML = `
    <span class="pokemon-id">${formattedId}</span>
    <div class="pokemon-img-wrap">
      <img src="${sprite}" alt="${localizedPokemonName}" loading="lazy" />
    </div>
    <h3 class="pokemon-name">${localizedPokemonName}</h3>
    <div class="pokemon-types">${typesHtml}</div>
  `;
  return card;
}

export function setPokedexActive(active: boolean): void {
  isPokedexActive = active;
  if (!active) {
    currentRequestId++;
  }
}

/**
 * Update all currently rendered cards in-place when language changes,
 * without flickering or reloading images.
 */
async function refreshCardsLanguage(lang: SupportedLanguage): Promise<void> {
  if (isPokedexActive) {
    updateRegionHeaderDOM(lang);
  }

  // Immediately update all type badges
  document.querySelectorAll<HTMLElement>('.pokemon-card .type-badge').forEach((badge) => {
    const typeSlug = badge.getAttribute('data-type');
    if (typeSlug) {
      badge.textContent = getLocalizedTypeName(typeSlug, lang);
    }
  });

  // Update Pokémon names using cached or fetched PokemonSpecies
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.pokemon-card'));
  const BATCH_SIZE = 30;

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    if (getLanguage() !== lang) return;
    const batch = cards.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (card) => {
        const idAttr = card.getAttribute('data-pokemon-id');
        const defaultName = card.getAttribute('data-default-name') || '';
        const nameEl = card.querySelector<HTMLElement>('.pokemon-name');
        if (!idAttr || !nameEl) return;

        if (lang === 'en') {
          nameEl.textContent = capitalize(defaultName);
          return;
        }

        try {
          const species = await api.pokemon.getPokemonSpeciesById(Number(idAttr));
          if (getLanguage() === lang) {
            nameEl.textContent = resolveLocalizedName(species.names, defaultName, lang);
          }
        } catch {
          nameEl.textContent = capitalize(defaultName);
        }
      })
    );
  }
}

// Subscribe to language changes
onLanguageChange((lang) => {
  refreshCardsLanguage(lang);
});

/**
 * Fetch Pokémon by Generation and populate the region header + grid.
 * Defaults to Generation I (Kanto).
 */
export async function loadPokedex(
  generationId: number | string = activeGenerationId
): Promise<void> {
  isPokedexActive = true;
  setGamesPageActive(false);
  activeGenerationId = generationId;

  const grid = document.getElementById('pokedex');
  const gamesContainer = document.getElementById('games-view');
  const regionHeader = document.getElementById('generation-header');
  if (!grid) return;

  grid.style.display = '';
  if (gamesContainer) {
    gamesContainer.style.display = 'none';
  }

  const requestId = ++currentRequestId;
  const lang = getLanguage();

  grid.innerHTML = `<div class="state-message">${UI_TEXT[lang].loadingPokemon}</div>`;
  if (regionHeader) {
    regionHeader.innerHTML = `<h2 class="region-title">${UI_TEXT[lang].loadingRegion}</h2>`;
  }

  try {
    const generation =
      typeof generationId === 'number'
        ? await api.game.getGenerationById(generationId)
        : await api.game.getGenerationByName(generationId);

    if (requestId !== currentRequestId) return;

    // Sort species by their National Pokédex ID
    const sortedSpecies = [...generation.pokemon_species].sort(
      (a, b) => resourceId(a) - resourceId(b)
    );

    activeRegionSlug = generation.main_region.name;
    activeSpeciesCount = sortedSpecies.length;

    updateRegionHeaderDOM(getLanguage());
    grid.innerHTML = '';

    // Fetch and render in batches for fast initial display
    const BATCH_SIZE = 30;
    for (let i = 0; i < sortedSpecies.length; i += BATCH_SIZE) {
      if (requestId !== currentRequestId) return;

      const batch = sortedSpecies.slice(i, i + BATCH_SIZE);
      const currentLang = getLanguage();

      const items = await Promise.all(
        batch.map(async (speciesRef) => {
          const id = resourceId(speciesRef);
          const [pokemon, species] = await Promise.all([
            api.pokemon.getPokemonById(id),
            currentLang === 'en'
              ? Promise.resolve(null)
              : api.pokemon.getPokemonSpeciesById(id),
          ]);
          return { pokemon, species };
        })
      );

      if (requestId !== currentRequestId) return;

      const renderLang = getLanguage();
      const fragment = document.createDocumentFragment();
      items.forEach(({ pokemon, species }) => {
        fragment.appendChild(renderCard(pokemon, species, renderLang));
      });
      grid.appendChild(fragment);
    }
  } catch (err) {
    if (requestId !== currentRequestId) return;
    console.error('Failed to load Pokémon data:', err);
    grid.innerHTML = `<div class="state-message error">${UI_TEXT[getLanguage()].errorLoad}</div>`;
  }
}
