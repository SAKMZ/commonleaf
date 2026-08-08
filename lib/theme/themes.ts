/**
 * Paper themes.
 *
 * Each theme is a complete palette rather than a single background colour: a
 * sheet of paper, the desk it rests on, the ink, and the hairlines that
 * separate them. Defining them as data — instead of hand-writing ten blocks of
 * CSS — means the settings screen, the no-flash bootstrap script and the
 * stylesheet all read from one place and cannot drift apart.
 *
 * Adding a theme is a matter of appending an entry here.
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  /** The sheet the note is written on. */
  paper: string;
  /** The hairline along the edge of the sheet. */
  paperEdge: string;
  /** The surface the sheet rests on. */
  surface: string;
  /** A slightly deeper tone of the surface, for wells and inset areas. */
  surfaceSunken: string;
  /** Body text. */
  ink: string;
  /** Secondary text: dates, counts, captions. */
  inkMuted: string;
  /** Tertiary text: placeholders, disabled states. */
  inkFaint: string;
  /** Rules and borders. */
  rule: string;
  /** Links, marks, the ribbon. A second bottle of ink. */
  accent: string;
  /** The accent at low emphasis, for underlines and hovers. */
  accentSoft: string;
  /** Text selection background. */
  selection: string;
  /** The shadow the sheet casts. */
  shadow: string;
  /** Tint of the paper-grain overlay. */
  texture: string;
}

export interface PaperTheme {
  readonly id: string;
  readonly label: string;
  readonly mode: ThemeMode;
  readonly colors: ThemeColors;
}

export const themes: readonly PaperTheme[] = [
  {
    id: 'classic-ivory',
    label: 'Classic Ivory',
    mode: 'light',
    colors: {
      paper: '#F7F2E7',
      paperEdge: '#E4DBC6',
      surface: '#EAE2CF',
      surfaceSunken: '#E0D6C0',
      ink: '#2B2723',
      inkMuted: '#5C554B',
      inkFaint: '#8B8172',
      rule: '#DED5C2',
      accent: '#3F5566',
      accentSoft: '#93A3AF',
      selection: 'rgba(201, 181, 138, 0.38)',
      shadow: 'rgba(60, 48, 32, 0.16)',
      texture: '#6B5B45',
    },
  },
  {
    id: 'warm-cream',
    label: 'Warm Cream',
    mode: 'light',
    colors: {
      paper: '#F4E8D1',
      paperEdge: '#E2D2B2',
      surface: '#E7DABE',
      surfaceSunken: '#DDCDAD',
      ink: '#2E2820',
      inkMuted: '#5E5646',
      inkFaint: '#8C816B',
      rule: '#DFD0B0',
      accent: '#6B4F3A',
      accentSoft: '#AE9179',
      selection: 'rgba(198, 166, 112, 0.38)',
      shadow: 'rgba(80, 60, 30, 0.18)',
      texture: '#6B5738',
    },
  },
  {
    id: 'antique',
    label: 'Antique',
    mode: 'light',
    colors: {
      paper: '#E8DDC8',
      paperEdge: '#D5C7A9',
      surface: '#DBCEB5',
      surfaceSunken: '#D0C1A3',
      ink: '#302A22',
      inkMuted: '#5A5142',
      inkFaint: '#857A65',
      rule: '#D3C6AC',
      accent: '#5C4A33',
      accentSoft: '#9C8B72',
      selection: 'rgba(184, 158, 110, 0.40)',
      shadow: 'rgba(70, 55, 30, 0.20)',
      texture: '#5E4E35',
    },
  },
  {
    id: 'old-manuscript',
    label: 'Old Manuscript',
    mode: 'light',
    colors: {
      paper: '#E2D4B7',
      paperEdge: '#CCBB98',
      surface: '#D4C4A3',
      surfaceSunken: '#C9B894',
      ink: '#33291B',
      inkMuted: '#5C4F38',
      inkFaint: '#877A5F',
      rule: '#CDBD9B',
      accent: '#6A4A28',
      accentSoft: '#A38B6B',
      selection: 'rgba(174, 146, 96, 0.42)',
      shadow: 'rgba(70, 50, 20, 0.22)',
      texture: '#5A4527',
    },
  },
  {
    id: 'coffee-stained',
    label: 'Coffee Stained',
    mode: 'light',
    colors: {
      paper: '#D9C7A2',
      paperEdge: '#C2AC81',
      surface: '#CAB58D',
      surfaceSunken: '#BFA87D',
      ink: '#362C1C',
      inkMuted: '#5E5034',
      inkFaint: '#8A7B5C',
      rule: '#C6B189',
      accent: '#6E4B24',
      accentSoft: '#A38A62',
      selection: 'rgba(163, 131, 78, 0.42)',
      shadow: 'rgba(60, 40, 15, 0.25)',
      texture: '#54401F',
    },
  },
  {
    id: 'cotton-paper',
    label: 'Cotton Paper',
    mode: 'light',
    colors: {
      paper: '#F5EFE2',
      paperEdge: '#E3DAC7',
      surface: '#E9E1D0',
      surfaceSunken: '#DFD5C1',
      ink: '#2A2723',
      inkMuted: '#5A554C',
      inkFaint: '#8A8375',
      rule: '#E0D8C7',
      accent: '#47566B',
      accentSoft: '#98A3B1',
      selection: 'rgba(190, 178, 148, 0.38)',
      shadow: 'rgba(60, 50, 35, 0.15)',
      texture: '#6A5F4C',
    },
  },
  {
    id: 'rice-paper',
    label: 'Rice Paper',
    mode: 'light',
    colors: {
      paper: '#EEE6D6',
      paperEdge: '#DCD2BC',
      surface: '#E2D9C6',
      surfaceSunken: '#D8CEB9',
      ink: '#2C2822',
      inkMuted: '#5B5549',
      inkFaint: '#8A8270',
      rule: '#DBD1BD',
      accent: '#4C5468',
      accentSoft: '#9AA0AE',
      selection: 'rgba(186, 172, 138, 0.38)',
      shadow: 'rgba(60, 50, 35, 0.16)',
      texture: '#655B48',
    },
  },
  {
    id: 'sepia',
    label: 'Sepia',
    mode: 'light',
    colors: {
      paper: '#E3D3B5',
      paperEdge: '#CEBB97',
      surface: '#D6C5A4',
      surfaceSunken: '#CBB994',
      ink: '#33291D',
      inkMuted: '#5C503C',
      inkFaint: '#887B62',
      rule: '#CFBE9C',
      accent: '#6B4A2A',
      accentSoft: '#A48D6D',
      selection: 'rgba(173, 145, 99, 0.42)',
      shadow: 'rgba(70, 50, 25, 0.20)',
      texture: '#5A4629',
    },
  },
  {
    id: 'dark-parchment',
    label: 'Dark Parchment',
    mode: 'dark',
    colors: {
      paper: '#38322D',
      paperEdge: '#4A433B',
      surface: '#2A2521',
      surfaceSunken: '#211D1A',
      ink: '#E8DFCD',
      inkMuted: '#B7AC96',
      inkFaint: '#8A806D',
      rule: '#4A433B',
      accent: '#C9A96A',
      accentSoft: '#7E6C46',
      selection: 'rgba(201, 169, 106, 0.28)',
      shadow: 'rgba(0, 0, 0, 0.45)',
      texture: '#E8DFCD',
    },
  },
  {
    id: 'dark-library',
    label: 'Dark Library',
    mode: 'dark',
    colors: {
      paper: '#2C2926',
      paperEdge: '#3E3A35',
      surface: '#201E1B',
      surfaceSunken: '#191715',
      ink: '#E2DACA',
      inkMuted: '#ADA391',
      inkFaint: '#7E7565',
      rule: '#3E3A35',
      accent: '#B99A62',
      accentSoft: '#75623F',
      selection: 'rgba(185, 154, 98, 0.26)',
      shadow: 'rgba(0, 0, 0, 0.50)',
      texture: '#E2DACA',
    },
  },
] as const;

export const DEFAULT_THEME_ID = 'classic-ivory';

export function findTheme(id: string): PaperTheme {
  return themes.find((theme) => theme.id === id) ?? themes[0];
}

/** The light and dark themes chosen when the reader follows their system. */
export const SYSTEM_THEME_PAIR = {
  light: 'classic-ivory',
  dark: 'dark-library',
} as const;
