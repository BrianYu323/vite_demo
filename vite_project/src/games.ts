import type { Version, VersionGroup } from 'pokenode-ts';
import {
  UI_TEXT,
  formatGenerationShort,
  getLanguage,
  getLocalizedRegionName,
  onLanguageChange,
  resolveLocalizedName,
  type SupportedLanguage,
} from './i18n';
import { api, setPokedexActive } from './pokedex';

interface GameRowData {
  version: Version;
  versionGroup: VersionGroup | undefined;
}

let cachedGameRows: GameRowData[] = [];
let isGamesPageActive = false;

export function setGamesPageActive(active: boolean): void {
  isGamesPageActive = active;
}

function formatSlugTitle(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' / ');
}

/**
 * Fetch all game versions and their corresponding version groups from PokéAPI.
 */
async function fetchAllGameRows(): Promise<GameRowData[]> {
  if (cachedGameRows.length > 0) return cachedGameRows;

  const [versionList, groupList] = await Promise.all([
    api.game.listVersions(0, 100),
    api.game.listVersionGroups(0, 100),
  ]);

  const [versions, groups] = await Promise.all([
    Promise.all(versionList.results.map((v) => api.game.getVersionByName(v.name))),
    Promise.all(groupList.results.map((g) => api.game.getVersionGroupByName(g.name))),
  ]);

  const groupMap = new Map<string, VersionGroup>();
  groups.forEach((g) => groupMap.set(g.name, g));

  cachedGameRows = versions
    .sort((a, b) => a.id - b.id)
    .map((version) => ({
      version,
      versionGroup: groupMap.get(version.version_group.name),
    }));

  return cachedGameRows;
}

/**
 * Render the games header and table using the current language.
 */
function renderGamesTableDOM(rows: GameRowData[], lang: SupportedLanguage = getLanguage()): void {
  const headerContainer = document.getElementById('generation-header');
  const gamesContainer = document.getElementById('games-view');
  if (!gamesContainer) return;

  const t = UI_TEXT[lang];

  if (headerContainer) {
    headerContainer.innerHTML = `
      <div class="region-header-content">
        <h2 class="region-title">${t.gamesTitle}</h2>
        <span class="generation-badge">${rows.length} ${t.gamesUnit}</span>
      </div>
    `;
  }

  const tbodyHtml = rows
    .map(({ version, versionGroup }) => {
      const formattedId = `#${version.id.toString().padStart(2, '0')}`;
      const versionName = resolveLocalizedName(version.names, version.name, lang);
      const groupTitle = formatSlugTitle(version.version_group.name);
      const genLabel = versionGroup
        ? formatGenerationShort(versionGroup.generation.name, lang)
        : '—';
      const regionsLabel =
        versionGroup && versionGroup.regions.length > 0
          ? versionGroup.regions
              .map((r) => getLocalizedRegionName(r.name, undefined, lang))
              .join(', ')
          : '—';

      return `
        <tr>
          <td class="col-id">${formattedId}</td>
          <td class="col-version">
            <span class="version-pill version-${version.name}">${versionName}</span>
            <small class="version-slug">${version.name}</small>
          </td>
          <td class="col-group">${groupTitle}</td>
          <td class="col-gen"><span class="gen-tag">${genLabel}</span></td>
          <td class="col-region">${regionsLabel}</td>
        </tr>
      `;
    })
    .join('');

  gamesContainer.innerHTML = `
    <div class="games-table-card">
      <div class="table-responsive">
        <table class="games-table">
          <thead>
            <tr>
              <th>${t.colId}</th>
              <th>${t.colVersion}</th>
              <th>${t.colVersionGroup}</th>
              <th>${t.colGeneration}</th>
              <th>${t.colRegion}</th>
            </tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Re-render table in place when language changes while on Games page
onLanguageChange((lang) => {
  if (isGamesPageActive && cachedGameRows.length > 0) {
    renderGamesTableDOM(cachedGameRows, lang);
  }
});

/**
 * Switch to the Games view and load the table of all Pokémon games & versions.
 */
export async function loadGamesPage(): Promise<void> {
  isGamesPageActive = true;
  setPokedexActive(false);

  const pokedexGrid = document.getElementById('pokedex');
  const gamesContainer = document.getElementById('games-view');
  const headerContainer = document.getElementById('generation-header');

  if (pokedexGrid) {
    pokedexGrid.style.display = 'none';
  }
  if (gamesContainer) {
    gamesContainer.style.display = 'block';
  }

  const lang = getLanguage();
  const t = UI_TEXT[lang];

  if (cachedGameRows.length > 0) {
    renderGamesTableDOM(cachedGameRows, lang);
    return;
  }

  if (headerContainer) {
    headerContainer.innerHTML = `<h2 class="region-title">${t.loadingGames}</h2>`;
  }
  if (gamesContainer) {
    gamesContainer.innerHTML = `<div class="state-message">${t.loadingGames}</div>`;
  }

  try {
    const rows = await fetchAllGameRows();
    if (!isGamesPageActive) return;
    renderGamesTableDOM(rows, getLanguage());
  } catch (err) {
    if (!isGamesPageActive) return;
    console.error('Failed to load games data:', err);
    if (gamesContainer) {
      gamesContainer.innerHTML = `<div class="state-message error">${UI_TEXT[getLanguage()].errorLoad}</div>`;
    }
  }
}
