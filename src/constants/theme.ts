export const COLORS = {
  primary: '#1a73e8',
  primaryDark: '#1557b0',
  primaryLight: '#e8f0fe',
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#212121',
  textSecondary: '#757575',
  border: '#e0e0e0',
  error: '#d32f2f',
  success: '#2e7d32',
  warning: '#f9a825',
  white: '#ffffff',
  black: '#000000',
  headerBackground: '#1a73e8',
  headerText: '#ffffff',
  rowEven: '#ffffff',
  rowOdd: '#f9f9f9',
  solucionadoSi: '#c8e6c9',
  solucionadoNo: '#ffcdd2',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const FONT_SIZES = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const TABLE_COLUMN_WIDTHS = {
  fecha: 110,
  numeroBastidor: 110,
  tipoAveria: 120,
  intervencion: 130,
  lugar: 130,
  observacion: 300,
  solucionado: 110,
} as const;
