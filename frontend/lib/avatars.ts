export interface TutorAvatar {
  id: string;
  name: string;
  nativeName: string;
  era: string;
  civilization: 'ancient-greek' | 'greek-christian' | 'nahuatl';
  role: string;
  symbol: string;
  /** CSS hex values — avoids Tailwind class-name purging */
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const AVATARS: TutorAvatar[] = [
  // ── Ancient Greek ──────────────────────────────────────────────────────────
  {
    id: 'socrates',
    name: 'Socrates',
    nativeName: 'Σωκράτης',
    era: '470–399 BCE',
    civilization: 'ancient-greek',
    role: 'Philosopher of Athens',
    symbol: 'Σ',
    bgColor: '#92400e',
    textColor: '#fde68a',
    borderColor: '#d97706',
  },
  {
    id: 'plato',
    name: 'Plato',
    nativeName: 'Πλάτων',
    era: '428–348 BCE',
    civilization: 'ancient-greek',
    role: 'Founder of the Academy',
    symbol: 'Π',
    bgColor: '#1e3a8a',
    textColor: '#bfdbfe',
    borderColor: '#3b82f6',
  },
  {
    id: 'aristotle',
    name: 'Aristotle',
    nativeName: 'Ἀριστοτέλης',
    era: '384–322 BCE',
    civilization: 'ancient-greek',
    role: 'Philosopher & Scientist',
    symbol: 'Α',
    bgColor: '#5b21b6',
    textColor: '#e9d5ff',
    borderColor: '#8b5cf6',
  },
  {
    id: 'homer',
    name: 'Homer',
    nativeName: 'Ὅμηρος',
    era: '8th century BCE',
    civilization: 'ancient-greek',
    role: 'Epic Poet',
    symbol: 'Ο',
    bgColor: '#9a3412',
    textColor: '#fed7aa',
    borderColor: '#f97316',
  },
  {
    id: 'hypatia',
    name: 'Hypatia',
    nativeName: 'Ὑπατία',
    era: '360–415 CE',
    civilization: 'ancient-greek',
    role: 'Mathematician & Philosopher',
    symbol: 'Υ',
    bgColor: '#0f766e',
    textColor: '#99f6e4',
    borderColor: '#14b8a6',
  },
  {
    id: 'sappho',
    name: 'Sappho',
    nativeName: 'Σαπφώ',
    era: '630–570 BCE',
    civilization: 'ancient-greek',
    role: 'Lyric Poet of Lesbos',
    symbol: 'Σ',
    bgColor: '#9f1239',
    textColor: '#fecdd3',
    borderColor: '#f43f5e',
  },

  // ── Greek Christian ────────────────────────────────────────────────────────
  {
    id: 'paul',
    name: 'Paul the Apostle',
    nativeName: 'Παῦλος',
    era: '5–64 CE',
    civilization: 'greek-christian',
    role: 'Apostle · Epistle Writer',
    symbol: 'Π',
    bgColor: '#334155',
    textColor: '#e2e8f0',
    borderColor: '#94a3b8',
  },
  {
    id: 'chrysostom',
    name: 'John Chrysostom',
    nativeName: 'Ἰωάννης Χρυσόστομος',
    era: '347–407 CE',
    civilization: 'greek-christian',
    role: 'Archbishop · Church Father',
    symbol: 'Ι',
    bgColor: '#78350f',
    textColor: '#fef3c7',
    borderColor: '#f59e0b',
  },

  // ── Classical Nahuatl ──────────────────────────────────────────────────────
  {
    id: 'nezahualcoyotl',
    name: 'Nezahualcoyotl',
    nativeName: 'Nezahualcoyōtl',
    era: '1402–1472 CE',
    civilization: 'nahuatl',
    role: 'Poet-King of Texcoco',
    symbol: 'N',
    bgColor: '#14532d',
    textColor: '#bbf7d0',
    borderColor: '#22c55e',
  },
  {
    id: 'moctezuma',
    name: 'Moctezuma II',
    nativeName: 'Motēuczōma Xōcoyōtzin',
    era: '1466–1520 CE',
    civilization: 'nahuatl',
    role: 'Huey Tlatoani of Tenochtitlan',
    symbol: 'M',
    bgColor: '#7f1d1d',
    textColor: '#fecaca',
    borderColor: '#ef4444',
  },
  {
    id: 'malintzin',
    name: 'Malintzin',
    nativeName: 'Malintzin',
    era: 'c. 1500–1529 CE',
    civilization: 'nahuatl',
    role: 'Interpreter · Diplomat',
    symbol: 'M',
    bgColor: '#164e63',
    textColor: '#cffafe',
    borderColor: '#06b6d4',
  },
  {
    id: 'cuauhtemoc',
    name: 'Cuauhtémoc',
    nativeName: 'Cuāuhtemōc',
    era: 'c. 1495–1525 CE',
    civilization: 'nahuatl',
    role: 'Last Ruler of Tenochtitlan',
    symbol: 'C',
    bgColor: '#44403c',
    textColor: '#d6d3d1',
    borderColor: '#a8a29e',
  },
];

export const CIVILIZATION_LABELS: Record<TutorAvatar['civilization'], string> = {
  'ancient-greek': 'Ancient Greek',
  'greek-christian': 'Greek Christian',
  'nahuatl': 'Classical Nahuatl',
};

export const DEFAULT_AVATAR_ID = 'socrates';

export function getAvatar(id: string | null | undefined): TutorAvatar {
  return AVATARS.find(a => a.id === id) ?? AVATARS.find(a => a.id === DEFAULT_AVATAR_ID)!;
}

/** Load avatar id from localStorage, return the matching avatar */
export function loadStoredAvatar(): TutorAvatar {
  if (typeof window === 'undefined') return getAvatar(DEFAULT_AVATAR_ID);
  return getAvatar(localStorage.getItem('chronos_avatar'));
}
