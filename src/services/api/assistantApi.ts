import { callApi } from './apiClient';

export type AiAskFilters = {
  status: 'all' | 'resolved' | 'pending';
  tipoAveria?: string | null;
};

export type AiState =
  | 'ok'
  | 'limite_usuario'
  | 'limite_global'
  | 'no_configurada'
  | 'quota'
  | 'unavailable'
  | 'bad_response';

export type RelatedFault = {
  id: string;
  fecha: string;
  equipo: string;
  numeroBastidor: string;
  tipoAveria: string;
  registro: string;
  solucionado: boolean;
  motivo: string;
};

export type ManualPageHit = {
  manualId: string;
  titulo: string;
  equipo: string;
  pagina: number;
  extracto: string;
};

export type AiAnswer = {
  resumen: string;
  suficientes: boolean;
  antecedentes: { id: string; motivo: string }[];
  causas: { texto: string; tipo: 'documentada' | 'hipotesis'; fuentes: string[] }[];
  comprobaciones: { texto: string; tipo: 'documentada' | 'hipotesis' | 'general'; fuentes: string[] }[];
  solucionesPrevias: { texto: string; fuente: string }[];
  fuentesManuales: { manualId: string; pagina: number }[];
};

export type AiAskResponse = {
  relacionadas: RelatedFault[];
  matchedCount: number;
  manualesEncontrados: ManualPageHit[];
  ia: { estado: AiState; proveedor?: string; detalle?: string };
  estadisticas?: {
    total: number;
    resueltas: number;
    pendientes: number;
    porTipo: { nombre: string; total: number }[];
    porIntervencion: { nombre: string; total: number }[];
    porBastidor: { nombre: string; total: number }[];
  };
  respuesta?: AiAnswer;
};

export async function askAssistant(
  pregunta: string,
  filters: AiAskFilters,
  lang: 'es' | 'en'
): Promise<AiAskResponse> {
  return callApi<AiAskResponse>('ia.consultar', {
    pregunta,
    lang,
    filtros: { status: filters.status, tipo: filters.tipoAveria ?? null },
  });
}
