export const colors = {
  bg: '#F7F8F7',
  card: '#FFFFFF',
  ink: '#14201C',
  sub: '#5C6B65',
  line: '#E2E7E4',
  accent: '#0F6B54',
  accentSoft: '#E6F1ED',
  warn: '#B4600A',
  warnSoft: '#FBEFE1',
  danger: '#A32B21',
  dangerSoft: '#FBEAE8',
  ok: '#2E6B3A',
};

export const type = {
  h1: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  sub: { fontSize: 13, color: colors.sub, lineHeight: 19 },
  mono: { fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
};

export const space = (n) => n * 4;
