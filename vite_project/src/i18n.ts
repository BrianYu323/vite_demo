import { localize, type Name } from 'pokenode-ts';

export type SupportedLanguage = 'en' | 'zh-Hant' | 'ja';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'zh-Hant', label: '繁體中文', shortLabel: '繁中' },
  { code: 'ja', label: '日本語', shortLabel: '日本語' },
];

let currentLanguage: SupportedLanguage = 'en';
const listeners: Array<(lang: SupportedLanguage) => void> = [];

export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function setLanguage(lang: SupportedLanguage): void {
  if (currentLanguage === lang) return;
  currentLanguage = lang;
  listeners.forEach((listener) => listener(currentLanguage));
}

export function onLanguageChange(listener: (lang: SupportedLanguage) => void): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

/** UI translations for static navigation & status labels */
export const UI_TEXT: Record<
  SupportedLanguage,
  {
    allPokemon: string;
    generations: string;
    games: string;
    types: string;
    about: string;
    menu: string;
    loadingPokemon: string;
    loadingRegion: string;
    loadingGames: string;
    errorLoad: string;
    pokemonUnit: string;
    gamesUnit: string;
    gamesTitle: string;
    colId: string;
    colVersion: string;
    colVersionGroup: string;
    colGeneration: string;
    colRegion: string;
    languageLabel: string;
    movesLabel: string;
    statsLabel: string;
    loadingDetail: string;
    loading3d: string;
    close: string;
    prev: string;
    next: string;
    evolutionChainLabel: string;
    genderLabel: string;
    maleLabel: string;
    femaleLabel: string;
    genderlessLabel: string;
    shinyLabel: string;
    regionalFormsLabel: string;
  }
> = {
  en: {
    allPokemon: 'All Pokémon',
    generations: 'Generations',
    games: 'Games',
    types: 'Types',
    about: 'About',
    menu: 'Menu',
    loadingPokemon: 'Loading Pokémon...',
    loadingRegion: 'Loading region...',
    loadingGames: 'Loading games & versions...',
    errorLoad: '❌ Unable to load data. Please try again later.',
    pokemonUnit: 'Pokémon',
    gamesUnit: 'Versions',
    gamesTitle: 'Pokémon Games & Versions',
    colId: 'ID',
    colVersion: 'Game Version',
    colVersionGroup: 'Version Group',
    colGeneration: 'Generation',
    colRegion: 'Region',
    languageLabel: 'Language',
    movesLabel: 'Moves',
    statsLabel: 'Stats',
    loadingDetail: 'Loading Pokémon details...',
    loading3d: 'Loading 3D model...',
    close: 'Close',
    prev: 'Previous Pokémon',
    next: 'Next Pokémon',
    evolutionChainLabel: 'Evolution Chain',
    genderLabel: 'Gender',
    maleLabel: 'Male',
    femaleLabel: 'Female',
    genderlessLabel: 'Genderless',
    shinyLabel: 'Shiny',
    regionalFormsLabel: 'Regional & Special Evolutions',
  },
  'zh-Hant': {
    allPokemon: '所有寶可夢',
    generations: '世代',
    games: '遊戲',
    types: '屬性',
    about: '關於',
    menu: '選單',
    loadingPokemon: '正在載入寶可夢...',
    loadingRegion: '正在載入地區...',
    loadingGames: '正在載入遊戲與版本列表...',
    errorLoad: '❌ 無法載入資料，請稍後再試。',
    pokemonUnit: '隻寶可夢',
    gamesUnit: '個版本',
    gamesTitle: '寶可夢遊戲與版本列表',
    colId: '編號',
    colVersion: '遊戲版本',
    colVersionGroup: '版本群組',
    colGeneration: '世代',
    colRegion: '地區',
    languageLabel: '語言',
    movesLabel: '招式',
    statsLabel: '能力值',
    loadingDetail: '正在載入寶可夢資料...',
    loading3d: '正在載入 3D 模型...',
    close: '關閉',
    prev: '上一隻寶可夢',
    next: '下一隻寶可夢',
    evolutionChainLabel: '進化鏈',
    genderLabel: '性別',
    maleLabel: '雄性',
    femaleLabel: '雌性',
    genderlessLabel: '無性別',
    shinyLabel: '異色',
    regionalFormsLabel: '地區形態與特殊進化',
  },
  ja: {
    allPokemon: 'すべてのポケモン',
    generations: '世代',
    games: 'ゲーム',
    types: 'タイプ',
    about: '概要',
    menu: 'メニュー',
    loadingPokemon: 'ポケモンを読み込み中...',
    loadingRegion: '地方を読み込み中...',
    loadingGames: 'ゲームとバージョンを読み込み中...',
    errorLoad: '❌ データを読み込めませんでした。',
    pokemonUnit: '匹のポケモン',
    gamesUnit: 'バージョン',
    gamesTitle: 'ポケモンゲーム＆バージョン一覧',
    colId: 'ID',
    colVersion: 'バージョン',
    colVersionGroup: 'バージョングループ',
    colGeneration: '世代',
    colRegion: '地方',
    languageLabel: '言語',
    movesLabel: 'わざ',
    statsLabel: 'ステータス',
    loadingDetail: 'ポケモンの詳細を読み込み中...',
    loading3d: '3Dモデルを読み込み中...',
    close: '閉じる',
    prev: '前のポケモン',
    next: '次のポケモン',
    evolutionChainLabel: '進化チェーン',
    genderLabel: '性別',
    maleLabel: 'オス',
    femaleLabel: 'メス',
    genderlessLabel: '性別不明',
    shinyLabel: '色違い',
    regionalFormsLabel: 'リージョンフォーム・特殊進化',
  },
};

/** Fallback localized names for Regions in case PokéAPI region endpoint lacks zh-Hant */
const REGION_FALLBACKS: Record<string, Record<SupportedLanguage, string>> = {
  kanto: { en: 'Kanto', 'zh-Hant': '關都', ja: 'カントー' },
  johto: { en: 'Johto', 'zh-Hant': '城都', ja: 'ジョウト' },
  hoenn: { en: 'Hoenn', 'zh-Hant': '豐緣', ja: 'ホウエン' },
  sinnoh: { en: 'Sinnoh', 'zh-Hant': '神奧', ja: 'シンオウ' },
  unova: { en: 'Unova', 'zh-Hant': '合眾', ja: 'イッシュ' },
  kalos: { en: 'Kalos', 'zh-Hant': '卡洛斯', ja: 'カロス' },
  alola: { en: 'Alola', 'zh-Hant': '阿羅拉', ja: 'アローラ' },
  galar: { en: 'Galar', 'zh-Hant': '伽勒爾', ja: 'ガラル' },
  hisui: { en: 'Hisui', 'zh-Hant': '洗翠', ja: 'ヒスイ' },
  paldea: { en: 'Paldea', 'zh-Hant': '帕底亞', ja: 'パルデア' },
};

/** Localized names for Pokémon Types */
const TYPE_TRANSLATIONS: Record<string, Record<SupportedLanguage, string>> = {
  normal: { en: 'Normal', 'zh-Hant': '一般', ja: 'ノーマル' },
  fire: { en: 'Fire', 'zh-Hant': '火', ja: 'ほのお' },
  water: { en: 'Water', 'zh-Hant': '水', ja: 'みず' },
  grass: { en: 'Grass', 'zh-Hant': '草', ja: 'くさ' },
  electric: { en: 'Electric', 'zh-Hant': '電', ja: 'でんき' },
  ice: { en: 'Ice', 'zh-Hant': '冰', ja: 'こおり' },
  fighting: { en: 'Fighting', 'zh-Hant': '格鬥', ja: 'かくとう' },
  poison: { en: 'Poison', 'zh-Hant': '毒', ja: 'どく' },
  ground: { en: 'Ground', 'zh-Hant': '地面', ja: 'じめん' },
  flying: { en: 'Flying', 'zh-Hant': '飛行', ja: 'ひこう' },
  psychic: { en: 'Psychic', 'zh-Hant': '超能力', ja: 'エスパー' },
  bug: { en: 'Bug', 'zh-Hant': '蟲', ja: 'むし' },
  rock: { en: 'Rock', 'zh-Hant': '岩石', ja: 'いわ' },
  ghost: { en: 'Ghost', 'zh-Hant': '幽靈', ja: 'ゴースト' },
  dragon: { en: 'Dragon', 'zh-Hant': '龍', ja: 'ドラゴン' },
  dark: { en: 'Dark', 'zh-Hant': '惡', ja: 'あく' },
  steel: { en: 'Steel', 'zh-Hant': '鋼', ja: 'はがね' },
  fairy: { en: 'Fairy', 'zh-Hant': '妖精', ja: 'フェアリー' },
};

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Resolve a localized name from PokéAPI `Name[]` using `pokenode-ts` `localize()`.
 */
export function resolveLocalizedName(
  names: readonly Name[] | undefined,
  fallbackSlug: string,
  lang: SupportedLanguage = currentLanguage
): string {
  if (names && names.length > 0) {
    if (lang === 'ja') {
      const jaEntry =
        localize(names, { language: 'ja-Hrkt', fallback: 'ja' }) ||
        localize(names, 'en');
      if (jaEntry?.name) return jaEntry.name;
    } else {
      const entry = localize(names, { language: lang, fallback: 'en' });
      if (entry?.name) return entry.name;
    }
  }
  return capitalize(fallbackSlug);
}

/**
 * Resolve localized Region / Location name.
 */
export function getLocalizedRegionName(
  regionSlug: string,
  regionNames?: readonly Name[],
  lang: SupportedLanguage = currentLanguage
): string {
  const key = regionSlug.toLowerCase();
  if (regionNames && regionNames.length > 0) {
    const exact =
      lang === 'ja'
        ? localize(regionNames, { language: 'ja-Hrkt', fallback: 'ja' })
        : localize(regionNames, { language: lang, fallback: '' });
    if (exact?.name) return exact.name;
  }
  if (REGION_FALLBACKS[key]?.[lang]) {
    return REGION_FALLBACKS[key][lang];
  }
  return capitalize(regionSlug);
}

/**
 * Resolve localized Type badge label.
 */
export function getLocalizedTypeName(
  typeSlug: string,
  lang: SupportedLanguage = currentLanguage
): string {
  const key = typeSlug.toLowerCase();
  return TYPE_TRANSLATIONS[key]?.[lang] || capitalize(typeSlug);
}

/**
 * Format generation short label (e.g. "generation-i" -> "Gen I" / "第I世代")
 */
export function formatGenerationShort(
  genName: string,
  lang: SupportedLanguage = currentLanguage
): string {
  const parts = genName.split('-');
  const roman = parts.length === 2 ? parts[1].toUpperCase() : genName;
  if (lang === 'zh-Hant' || lang === 'ja') {
    return `第${roman}世代`;
  }
  return `Gen ${roman}`;
}


/** Localized names for base stats */
const STAT_TRANSLATIONS: Record<string, Record<SupportedLanguage, string>> = {
  hp: { en: 'HP', 'zh-Hant': 'HP', ja: 'HP' },
  attack: { en: 'Attack', 'zh-Hant': '攻擊', ja: 'こうげき' },
  defense: { en: 'Defense', 'zh-Hant': '防禦', ja: 'ぼうぎょ' },
  'special-attack': { en: 'Sp. Attack', 'zh-Hant': '特攻', ja: 'とくこう' },
  'special-defense': { en: 'Sp. Defense', 'zh-Hant': '特防', ja: 'とくぼう' },
  speed: { en: 'Speed', 'zh-Hant': '速度', ja: 'すばやさ' },
};

/**
 * Resolve localized base stat label (e.g. "special-attack" -> "Sp. Attack" / "特攻" / "とくこう").
 */
export function getLocalizedStatName(
  statSlug: string,
  lang: SupportedLanguage = currentLanguage
): string {
  return STAT_TRANSLATIONS[statSlug]?.[lang] || capitalize(statSlug);
}

/** Short localized badge labels for special forms (Mega, G-Max, Primal, Origin, Regional) */
const FORM_BADGE_TRANSLATIONS: Record<string, Record<SupportedLanguage, string>> = {
  mega: { en: 'Mega', 'zh-Hant': '超級進化', ja: 'メガシンカ' },
  'mega-x': { en: 'Mega X', 'zh-Hant': '超級進化 X', ja: 'メガシンカ X' },
  'mega-y': { en: 'Mega Y', 'zh-Hant': '超級進化 Y', ja: 'メガシンカ Y' },
  gmax: { en: 'G-Max', 'zh-Hant': '超極巨化', ja: 'キョダイマックス' },
  primal: { en: 'Primal', 'zh-Hant': '原始回歸', ja: 'ゲンシカイキ' },
  origin: { en: 'Origin', 'zh-Hant': '起源形態', ja: 'オリジンフォルム' },
  alola: { en: 'Alola', 'zh-Hant': '阿羅拉', ja: 'アローラ' },
  galar: { en: 'Galar', 'zh-Hant': '伽勒爾', ja: 'ガラル' },
  hisui: { en: 'Hisui', 'zh-Hant': '洗翠', ja: 'ヒスイ' },
  paldea: { en: 'Paldea', 'zh-Hant': '帕底亞', ja: 'パルデア' },
};

/**
 * Determine the form category key from a Pokémon or form slug (e.g. "venusaur-mega" -> "mega", "rattata-alola" -> "alola").
 */
export function getFormCategoryKey(slug: string): string | null {
  const lower = slug.toLowerCase();
  if (lower.endsWith('-mega-x')) return 'mega-x';
  if (lower.endsWith('-mega-y')) return 'mega-y';
  if (lower.endsWith('-mega')) return 'mega';
  if (lower.endsWith('-gmax')) return 'gmax';
  if (lower.endsWith('-primal')) return 'primal';
  if (lower.endsWith('-origin')) return 'origin';
  if (lower.includes('-alola')) return 'alola';
  if (lower.includes('-galar')) return 'galar';
  if (lower.includes('-hisui')) return 'hisui';
  if (lower.includes('-paldea')) return 'paldea';
  return null;
}

/**
 * Get a short localized badge tag for a special form slug (or null for default forms).
 */
export function getLocalizedFormTag(
  slug: string,
  lang: SupportedLanguage = currentLanguage
): string | null {
  const key = getFormCategoryKey(slug);
  if (!key) return null;
  return FORM_BADGE_TRANSLATIONS[key]?.[lang] ?? capitalize(key);
}

/**
 * Resolve localized full name for a Pokémon or special form (e.g., Mega Venusaur / 超級妙蛙花 / メガフシギバナ, or Alolan Rattata).
 */
export function resolveLocalizedFormName(
  speciesNames: readonly Name[] | undefined,
  formFullNames: readonly Name[] | undefined,
  formSubNames: readonly Name[] | undefined,
  slug: string,
  lang: SupportedLanguage = currentLanguage
): string {
  if (formFullNames && formFullNames.length > 0) {
    const fullEntry =
      lang === 'ja'
        ? localize(formFullNames, { language: 'ja-Hrkt', fallback: 'ja' })
        : localize(formFullNames, { language: lang, fallback: '' });
    if (fullEntry?.name) return fullEntry.name;
  }

  const baseName = resolveLocalizedName(speciesNames, slug.split('-')[0] || slug, lang);

  if (formSubNames && formSubNames.length > 0) {
    const subEntry =
      lang === 'ja'
        ? localize(formSubNames, { language: 'ja-Hrkt', fallback: 'ja' })
        : localize(formSubNames, { language: lang, fallback: '' });
    if (subEntry?.name) {
      return `${baseName} (${subEntry.name})`;
    }
  }

  const tag = getLocalizedFormTag(slug, lang);
  if (tag) {
    return `${baseName} (${tag})`;
  }

  return baseName;
}

