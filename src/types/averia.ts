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

export type Averia = {
  id: string;
  fecha: string;
  numeroBastidor: string;
  tipoAveria: AveriaType;
  intervencion: string;
  lugar: string;
  observacion: string;
  solucionado: boolean;
};

export type AveriaFormData = Omit<Averia, 'id'>;
