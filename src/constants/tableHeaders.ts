export const TABLE_HEADERS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'numeroBastidor', label: 'Nº Bastidor' },
  { key: 'tipoAveria', label: 'Tipo de Avería' },
  { key: 'intervencion', label: 'Intervención' },
  { key: 'lugar', label: 'Lugar' },
  { key: 'observacion', label: 'Observación' },
  { key: 'solucionado', label: 'Solucionado' },
] as const;

export const EXCEL_HEADERS = [
  'Fecha',
  'Nº Bastidor',
  'Tipo de Avería',
  'Intervención',
  'Lugar',
  'Observación',
  'Solucionado',
  'Ubicación real',
  'Latitud',
  'Longitud',
] as const;
