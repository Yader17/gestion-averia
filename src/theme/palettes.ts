// Corporate identity (logo): navy #00407E + orange #F7903D.
// Dark palette uses graphite / blue-grey surfaces, never pure black.

export type Palette = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  onPrimary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  errorSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  white: string;
  black: string;
  headerBackground: string;
  headerText: string;
  rowEven: string;
  rowOdd: string;
  solucionadoSi: string;
  solucionadoNo: string;
  overlay: string;
  tabBar: string;
  logoPlate: string;
  chart: readonly string[];
};

export const lightPalette: Palette = {
  primary: '#00407E',
  primaryDark: '#002F5E',
  primaryLight: '#E6EEF7',
  onPrimary: '#FFFFFF',
  accent: '#F7903D',
  background: '#F3F5F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  text: '#1B2430',
  textSecondary: '#5B6675',
  border: '#DDE2E9',
  error: '#C62828',
  errorSoft: '#FDECEC',
  success: '#2E7D32',
  successSoft: '#E5F3E6',
  warning: '#B26A00',
  warningSoft: '#FFF2E0',
  white: '#FFFFFF',
  black: '#000000',
  headerBackground: '#00407E',
  headerText: '#FFFFFF',
  rowEven: '#FFFFFF',
  rowOdd: '#F8FAFC',
  solucionadoSi: '#D5ECD7',
  solucionadoNo: '#F9D9D9',
  overlay: 'rgba(15, 23, 36, 0.45)',
  tabBar: '#FFFFFF',
  logoPlate: 'transparent',
  chart: ['#00407E', '#F7903D', '#3C8DBC', '#6B7C93', '#2E7D32', '#8E6BBF', '#C62828', '#B0803A'],
};

export const darkPalette: Palette = {
  primary: '#6FA8E6',
  primaryDark: '#4F8CCB',
  primaryLight: '#243447',
  onPrimary: '#0F1A2A',
  accent: '#F7A15C',
  background: '#161B22',
  surface: '#1F2630',
  surfaceAlt: '#252D39',
  text: '#E6EAF0',
  textSecondary: '#9AA6B6',
  border: '#323B49',
  error: '#EF7B7B',
  errorSoft: '#3A2527',
  success: '#6CC070',
  successSoft: '#223A27',
  warning: '#F0B35B',
  warningSoft: '#3B3020',
  white: '#FFFFFF',
  black: '#000000',
  headerBackground: '#1F2630',
  headerText: '#E6EAF0',
  rowEven: '#1F2630',
  rowOdd: '#232B36',
  solucionadoSi: '#24402A',
  solucionadoNo: '#472A2D',
  overlay: 'rgba(8, 11, 16, 0.6)',
  tabBar: '#1B222C',
  logoPlate: '#F3F5F8',
  chart: ['#6FA8E6', '#F7A15C', '#7CC4D8', '#9AA6B6', '#6CC070', '#B49BDC', '#EF7B7B', '#D2A862'],
};
