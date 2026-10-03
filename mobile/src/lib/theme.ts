// Green & cream (after the "Le Pavillon" palette): deep forest green pages, warm cream type and
// main buttons, muted creams for everything secondary. Red and green are kept only where they carry
// meaning (errors, a confirmed or paid booking), softened to read on green.
// Every colour in the app comes from here, named by role, so changing the look is this one file.
export const color = {
  bg: '#01180F',                       // screens: deep forest green
  surface: '#03291B',                  // cards, sheets, the car photo backdrop: the logo-circle green
  text: '#EADBBF',                     // cream
  textDim: '#A79F8A',                  // secondary text (7:1 on the background)
  textFaint: 'rgba(234,219,191,0.4)',  // placeholders
  line: 'rgba(234,219,191,0.14)',
  lineStrong: 'rgba(234,219,191,0.3)',
  primary: '#EADBBF',                  // main buttons, selected chips and dates
  onPrimary: '#01180F',
  onPrimaryDim: 'rgba(1,24,15,0.55)',  // counts inside a selected chip
  accent: '#EADBBF',                   // prices and highlights
  accentSoft: 'rgba(234,219,191,0.10)',
  disabled: 'rgba(234,219,191,0.22)',  // past days in the calendar
  struck: 'rgba(234,219,191,0.3)',     // booked days, struck through
  ring: 'rgba(234,219,191,0.7)',       // the car's floor ring
  ringGlow: '0 0 12px rgba(234,219,191,0.3)',
  glow: 'rgba(234,219,191,0.05)',      // soft light behind the car
  bar: 'rgba(1,24,15,0.94)',           // the fixed bar holding a screen's main button
  error: '#FF8A7A',
  errorLine: 'rgba(255,138,122,0.45)',
  ok: '#9ED9A8',
  overlay: 'rgba(0,10,6,0.6)',
};

export const font = {
  serif: 'BodoniModa_400Regular',
  serifItalic: 'BodoniModa_400Regular_Italic',
  serifMedium: 'BodoniModa_500Medium',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansBold: 'InstrumentSans_600SemiBold',
  arSerif: 'NotoNaskhArabic_400Regular',
  arSerifMedium: 'NotoNaskhArabic_500Medium',
  arSans: 'IBMPlexSansArabic_400Regular',
  arSansMedium: 'IBMPlexSansArabic_500Medium',
  arSansBold: 'IBMPlexSansArabic_600SemiBold',
};

export const space = { xs: 6, s: 10, m: 16, l: 24, xl: 36 };
export const radius = { s: 12, m: 18, l: 24, pill: 999 };
export const HIT = 44;   // minimum touch target
