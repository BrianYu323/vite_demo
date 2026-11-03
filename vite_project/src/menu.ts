import {
  SUPPORTED_LANGUAGES,
  UI_TEXT,
  formatGenerationShort,
  getLanguage,
  getLocalizedRegionName,
  onLanguageChange,
  setLanguage,
  type SupportedLanguage,
} from './i18n';
import { api } from './pokedex';

/**
 * Menu template and interaction logic for Pokédex responsive navigation.
 * - Mobile mode: expands directly under the title.
 * - Tablet mode: expands and shows on the left hand side of the page.
 * - Generations submenu: dynamically fetched from /generation and shown on hover.
 * - Language switcher: supports English (en), Traditional Chinese (zh-Hant), and Japanese (ja).
 */

export interface MenuOptions {
  onItemClick?: (id: string) => void;
  onGenerationSelect?: (genId: number) => void;
}

export interface RawGenerationData {
  id: number;
  genName: string;
  regionSlug: string;
}

let cachedGenerations: RawGenerationData[] = [];
let activeGenerationId = 1;

/**
 * Fetch all generations from `/generation` and extract raw generation & region slugs.
 */
export async function fetchGenerationLocations(): Promise<RawGenerationData[]> {
  if (cachedGenerations.length > 0) return cachedGenerations;

  const list = await api.game.listGenerations();
  const generations = await Promise.all(
    list.results.map((entry) => api.game.getGenerationByName(entry.name))
  );

  cachedGenerations = generations
    .sort((a, b) => a.id - b.id)
    .map((gen) => ({
      id: gen.id,
      genName: gen.name,
      regionSlug: gen.main_region.name,
    }));

  return cachedGenerations;
}

/**
 * Generates the HTML template for the header, navigation menus, language switcher, and tablet backdrop.
 */
export function renderMenuTemplate(): string {
  const lang = getLanguage();
  const t = UI_TEXT[lang];
  const currentLangOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];

  const langOptionsHtml = SUPPORTED_LANGUAGES.map(
    (opt) => `
      <li>
        <button type="button" class="lang-option${opt.code === lang ? ' active' : ''}" data-lang="${opt.code}">
          <span>${opt.label}</span>
          <small class="lang-code">${opt.shortLabel}</small>
        </button>
      </li>`
  ).join('');

  return `
    <header class="site-header">
      <div class="header-bar">
        <!-- Title stuck to the left hand side in all screen sizes -->
        <h1 class="site-title">Pokedex</h1>

        <div class="header-actions">
          <!-- Desktop navigation links (Web mode only) -->
          <nav class="desktop-nav" aria-label="Desktop Navigation">
            <div class="nav-dropdown">
              <a href="#generations" class="nav-link nav-dropdown-trigger active" data-filter="generations">
                <span data-i18n="generations">${t.generations}</span>
                <span class="dropdown-arrow">▾</span>
              </a>
              <ul id="desktop-generation-submenu" class="dropdown-submenu" aria-label="Generation Locations">
                <li class="submenu-loading">Loading...</li>
              </ul>
            </div>

            <a href="#games" class="nav-link" data-filter="games" data-i18n="games">${t.games}</a>
            <a href="#types" class="nav-link" data-filter="types" data-i18n="types">${t.types}</a>
            <a href="#about" class="nav-link" data-filter="about" data-i18n="about">${t.about}</a>
          </nav>

          <!-- Language Switcher Button & Dropdown (All screen sizes) -->
          <div id="lang-dropdown" class="lang-dropdown">
            <button id="lang-btn" class="lang-btn" type="button" aria-label="Change language" aria-expanded="false">
              <span class="lang-icon">🌐</span>
              <span id="lang-current-label" class="lang-current-label">${currentLangOption.shortLabel}</span>
              <span class="dropdown-arrow">▾</span>
            </button>
            <ul id="lang-menu" class="lang-menu" aria-label="Language options">
              ${langOptionsHtml}
            </ul>
          </div>

          <!-- Menu Button (Mobile & Tablet mode on the right hand side) -->
          <button id="menu-btn" class="menu-btn" type="button" aria-label="Toggle navigation menu" aria-expanded="false">
            <span class="bar bar-1"></span>
            <span class="bar bar-2"></span>
            <span class="bar bar-3"></span>
          </button>
        </div>
      </div>

      <!-- Responsive Navigation Menu:
           - Mobile: expands directly under the title
           - Tablet: expands and shows on the left hand side of the page -->
      <nav id="nav-menu" class="nav-menu" aria-label="Responsive Navigation Menu">
        <div class="tablet-menu-header">
          <span class="tablet-menu-title" data-i18n="menu">${t.menu}</span>
        </div>
        <ul class="menu-list">
          <li class="menu-item-has-children">
            <a href="#generations" class="menu-link menu-dropdown-trigger active" data-filter="generations">
              <span class="menu-icon">🏆</span>
              <span class="menu-text" data-i18n="generations">${t.generations}</span>
              <span class="dropdown-arrow">▾</span>
            </a>
            <ul id="mobile-generation-submenu" class="mobile-submenu" aria-label="Generation Locations">
              <li class="submenu-loading">Loading...</li>
            </ul>
          </li>
          <li>
            <a href="#games" class="menu-link" data-filter="games">
              <span class="menu-icon">🎮</span>
              <span class="menu-text" data-i18n="games">${t.games}</span>
            </a>
          </li>
          <li>
            <a href="#types" class="menu-link" data-filter="types">
              <span class="menu-icon">⚡</span>
              <span class="menu-text" data-i18n="types">${t.types}</span>
            </a>
          </li>
          <li>
            <a href="#about" class="menu-link" data-filter="about">
              <span class="menu-icon">ℹ️</span>
              <span class="menu-text" data-i18n="about">${t.about}</span>
            </a>
          </li>
        </ul>
      </nav>
    </header>

    <!-- Backdrop overlay for Tablet drawer -->
    <div id="menu-backdrop" class="menu-backdrop"></div>
  `;
}

/**
 * Render the generation submenu items into desktop and mobile/tablet lists for the current language.
 */
function renderSubmenuItems(
  generations: RawGenerationData[],
  lang: SupportedLanguage = getLanguage()
): void {
  const desktopSubmenu = document.getElementById('desktop-generation-submenu');
  const mobileSubmenu = document.getElementById('mobile-generation-submenu');

  if (desktopSubmenu) {
    desktopSubmenu.innerHTML = generations
      .map((item) => {
        const label = getLocalizedRegionName(item.regionSlug, undefined, lang);
        const shortGen = formatGenerationShort(item.genName, lang);
        const isActive = item.id === activeGenerationId;
        return `
          <li>
            <a href="#gen-${item.id}" class="submenu-link${isActive ? ' active' : ''}" data-gen="${item.id}">
              <span>${label}</span>
              <small class="submenu-gen">${shortGen}</small>
            </a>
          </li>`;
      })
      .join('');
  }

  if (mobileSubmenu) {
    mobileSubmenu.innerHTML = generations
      .map((item) => {
        const label = getLocalizedRegionName(item.regionSlug, undefined, lang);
        const shortGen = formatGenerationShort(item.genName, lang);
        const isActive = item.id === activeGenerationId;
        return `
          <li>
            <a href="#gen-${item.id}" class="submenu-link${isActive ? ' active' : ''}" data-gen="${item.id}">
              <span class="submenu-dot">•</span>
              <span>${label}</span>
              <small class="submenu-gen">(${shortGen})</small>
            </a>
          </li>`;
      })
      .join('');
  }
}

/**
 * Update static menu labels when language changes.
 */
function updateMenuLabelsLanguage(lang: SupportedLanguage): void {
  const t = UI_TEXT[lang];
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as keyof typeof t;
    if (key && t[key]) {
      el.textContent = t[key];
    }
  });

  const currentLangOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
  const currentLabelEl = document.getElementById('lang-current-label');
  if (currentLabelEl) {
    currentLabelEl.textContent = currentLangOption.shortLabel;
  }

  document.querySelectorAll<HTMLButtonElement>('.lang-option').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  if (cachedGenerations.length > 0) {
    renderSubmenuItems(cachedGenerations, lang);
  }
}

/**
 * Attaches event listeners to the rendered menu elements and populates the `/generation` submenu.
 */
export function initMenu(options?: MenuOptions) {
  const menuBtn = document.getElementById('menu-btn');
  const navMenu = document.getElementById('nav-menu');
  const backdrop = document.getElementById('menu-backdrop');
  const topLinks = document.querySelectorAll<HTMLAnchorElement>('.menu-link, .nav-link');
  const desktopSubmenu = document.getElementById('desktop-generation-submenu');
  const mobileSubmenu = document.getElementById('mobile-generation-submenu');
  const mobileDropdownItem = document.querySelector<HTMLLIElement>('.menu-item-has-children');
  const mobileDropdownTrigger = document.querySelector<HTMLAnchorElement>('.menu-dropdown-trigger');
  const langDropdown = document.getElementById('lang-dropdown');
  const langBtn = document.getElementById('lang-btn');
  const langMenu = document.getElementById('lang-menu');

  if (!menuBtn || !navMenu) {
    console.warn('Menu elements (#menu-btn or #nav-menu) not found.');
    return {
      open: () => {},
      close: () => {},
      toggle: () => {},
      isOpen: () => false,
    };
  }

  const isOpen = () => navMenu.classList.contains('is-open');

  const open = () => {
    navMenu.classList.add('is-open');
    menuBtn.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    if (backdrop) {
      backdrop.classList.add('is-open');
    }
  };

  const close = () => {
    navMenu.classList.remove('is-open');
    menuBtn.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (backdrop) {
      backdrop.classList.remove('is-open');
    }
    if (mobileDropdownItem) {
      mobileDropdownItem.classList.remove('submenu-open');
    }
  };

  const toggle = () => {
    if (isOpen()) {
      close();
    } else {
      open();
    }
  };

  // Subscribe to language changes
  onLanguageChange((lang) => {
    updateMenuLabelsLanguage(lang);
  });

  // Language switcher toggle & selection
  if (langBtn && langDropdown && langMenu) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = langDropdown.classList.toggle('is-open');
      langBtn.setAttribute('aria-expanded', String(expanded));
    });

    langMenu.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-option');
      if (!target) return;
      e.stopPropagation();

      const selectedLang = target.getAttribute('data-lang') as SupportedLanguage | null;
      if (selectedLang) {
        setLanguage(selectedLang);
      }
      langDropdown.classList.remove('is-open');
      langBtn.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('click', (e) => {
      if (!langDropdown.contains(e.target as Node)) {
        langDropdown.classList.remove('is-open');
        langBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Populate generation locations dynamically from PokéAPI `/generation`
  fetchGenerationLocations()
    .then((generations) => {
      renderSubmenuItems(generations, getLanguage());
    })
    .catch((err) => {
      console.error('Failed to load generations for menu:', err);
    });

  // Event delegation for dynamically rendered submenu links
  const handleSubmenuClick = (e: Event) => {
    const target = (e.target as HTMLElement).closest<HTMLAnchorElement>('.submenu-link');
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    const genAttr = target.getAttribute('data-gen');
    const genId = Number(genAttr);
    if (!Number.isNaN(genId) && genId > 0) {
      activeGenerationId = genId;
    }

    // Update active state on all submenu links
    document.querySelectorAll<HTMLAnchorElement>('.submenu-link').forEach((l) => {
      l.classList.remove('active');
    });
    if (genAttr) {
      document.querySelectorAll(`.submenu-link[data-gen="${genAttr}"]`).forEach((el) => {
        el.classList.add('active');
      });
    }

    // Highlight the parent "Generations" category
    topLinks.forEach((l) => l.classList.remove('active'));
    document.querySelectorAll('[data-filter="generations"]').forEach((el) => {
      el.classList.add('active');
    });

    close();

    if (!Number.isNaN(genId) && genId > 0 && options?.onGenerationSelect) {
      options.onGenerationSelect(genId);
    }
  };

  desktopSubmenu?.addEventListener('click', handleSubmenuClick);
  mobileSubmenu?.addEventListener('click', handleSubmenuClick);

  // Toggle button click (Mobile & Tablet)
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  // Close when clicking the backdrop (Tablet mode)
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      close();
    });
  }

  // Toggle submenu on click/tap for Mobile/Tablet "Generations" category (in addition to CSS :hover)
  if (mobileDropdownTrigger && mobileDropdownItem) {
    mobileDropdownTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mobileDropdownItem.classList.toggle('submenu-open');
    });
  }

  // Handle top-level menu item clicks (excluding Generations trigger)
  topLinks.forEach((link) => {
    if (
      link.classList.contains('menu-dropdown-trigger') ||
      link.classList.contains('nav-dropdown-trigger')
    ) {
      link.addEventListener('click', (e) => e.preventDefault());
      return;
    }

    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
      }

      topLinks.forEach((l) => l.classList.remove('active'));
      if (href) {
        document.querySelectorAll(`[href="${href}"]`).forEach((el) => {
          el.classList.add('active');
        });
      }

      close();

      const itemId = link.getAttribute('data-filter') || href?.replace('#', '') || '';
      if (options?.onItemClick) {
        options.onItemClick(itemId);
      }
    });
  });

  // Close when pressing the Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      close();
    }
  });

  // Auto-close when resizing to Desktop view (> 1024px)
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && isOpen()) {
      close();
    }
  });

  return { open, close, toggle, isOpen };
}
