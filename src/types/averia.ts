export const AVERIA_TYPES = [
  'Mecanica',
  'Electrica',
  'Canbus',
  'Actuadores',
  'Direccion',
  'Calibracion',
  'Bateria',
  'Inversor',
  'Software',
  'Motores',
  'Cargador',
  'Otro',
] as const;

export type AveriaType = (typeof AVERIA_TYPES)[number];

export const INTERVENCION_TYPES = [
  'Arrizabal',
  'Dayma',
  'Drago',
  'IngeniaGreen',
  'Maliv',
  'Noucolors',
  'Numatic',
  'PactoAmbiental',
  'Tenax',
  'Otro',
] as const;

export type IntervencionType = (typeof INTERVENCION_TYPES)[number];

export type AveriaPhoto = {
  id: string;
  uri: string;
  remoteUrl?: string;
  storagePath?: string;
  fileName: string;
  mimeType: string;
  width?: number;
  height?: number;
};

export type AveriaLocation = {
  latitude: number;
  longitude: number;
  displayName: string;
};

export type Averia = {
  id: string;
  fecha: string;
  numeroBastidor: string;
  tipoAveria: AveriaType;
  intervencion: string;
  lugar: string;
  ubicacion?: AveriaLocation | null;
  observacion: string;
  solucionado: boolean;
  fotos?: AveriaPhoto[];
  // Trazabilidad asignada por el servidor (nunca por el cliente).
  version?: number;
  creadoEn?: string;
  creadoPorNombre?: string | null;
  actualizadoEn?: string;
  actualizadoPorNombre?: string | null;
};

export type AveriaFormData = {
  fecha: string;
  numeroBastidor: string;
  tipoAveria: AveriaType;
  intervencion: string;
  lugar: string;
  ubicacion?: AveriaLocation | null;
  observacion: string;
  solucionado: boolean;
  fotos: AveriaPhoto[];
};

export function getAveriaPhotos(
  averia: Pick<Averia, 'fotos'> | Pick<AveriaFormData, 'fotos'>
): AveriaPhoto[] {
  return Array.isArray(averia.fotos) ? averia.fotos : [];
}
