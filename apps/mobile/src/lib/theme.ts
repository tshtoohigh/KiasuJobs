/** Design tokens. Kept in one place so screens never hard-code a hex value. */

export const colors = {
  bg: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F6',

  text: '#12141C',
  textMuted: '#5C6178',
  textFaint: '#9AA0B4',

  border: '#E3E6EF',

  primary: '#4E46E5',
  primaryDark: '#3B34C4',
  primarySoft: '#EEEDFD',

  // Swipe affordances
  apply: '#12A150',
  applySoft: '#E4F6EC',
  skip: '#E5484D',
  skipSoft: '#FDE8E8',

  warning: '#B45309',
  warningSoft: '#FEF3C7',

  overlay: 'rgba(12, 14, 22, 0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '500' },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0C0E16',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  soft: {
    shadowColor: '#0C0E16',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

/** Deterministic accent per company, so logo placeholders stay stable. */
const ACCENTS = ['#4E46E5', '#0E7490', '#B45309', '#9333EA', '#0F766E', '#BE123C'] as const;

export function accentForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  }
  return ACCENTS[hash % ACCENTS.length] ?? ACCENTS[0];
}
