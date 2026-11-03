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

