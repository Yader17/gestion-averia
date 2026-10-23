import { Averia } from '../../types/averia';
import { parseDate } from '../../utils/dateUtils';

/**
 * Local retrieval over the real fault history (first stage of the RAG pipeline).
 *
 * Method (documented, deterministic): every field of a record is tokenised
 * (lowercase, accent-insensitive). Each query token is matched exactly (or by
 * prefix for tokens of 4+ chars) against each field. A match adds
 * IDF(token) * fieldWeight to the record score. Resolved records get a x1.25
 * boost so verified solutions come first without hiding open cases.
 * Scores are used ONLY for ordering and are never shown as "similarity" values.
 */

export type RetrievalFilters = {
  status?: 'all' | 'resolved' | 'pending';
  dateFrom?: Date | null;
  dateTo?: Date | null;
  tipoAveria?: string | null;
};

export type FieldKey = 'numeroBastidor' | 'tipoAveria' | 'intervencion' | 'lugar' | 'observacion' | 'fecha';

export type RetrievalMatch = {
  averia: Averia;
  matchedTerms: string[];
  matchedFields: FieldKey[];
};

const FIELD_WEIGHTS: Record<FieldKey, number> = {
  observacion: 3,
  tipoAveria: 2.5,
  numeroBastidor: 2.5,
  intervencion: 1.5,
  lugar: 1,
  fecha: 1,
};

const FIELD_KEYS = Object.keys(FIELD_WEIGHTS) as FieldKey[];

const STOPWORDS = new Set([
  'a', 'al', 'algo', 'como', 'con', 'cual', 'cuales', 'cuantas', 'cuantos', 'de', 'del', 'el', 'en', 'es', 'esta',
  'este', 'fallo', 'ha', 'han', 'hay', 'la', 'las', 'lo', 'los', 'me', 'mi', 'para', 'por', 'que', 'se', 'sobre',
  'su', 'sus', 'un', 'una', 'y', 'ya', 'the', 'of', 'and', 'in', 'to', 'is', 'for', 'on', 'with', 'what', 'how',
  'any', 'similar', 'similares', 'anteriores', 'anteriormente', 'averia', 'averias',
]);

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function tokenMatches(queryToken: string, fieldTokens: string[]): boolean {
  return fieldTokens.some(
    (candidate) =>
      candidate === queryToken ||
      (queryToken.length >= 4 &&
        (candidate.startsWith(queryToken) || (candidate.length >= 4 && queryToken.startsWith(candidate))))
  );
}

function timestampOf(averia: Averia): number {
  return parseDate(averia.fecha)?.getTime() ?? 0;
}

function passesFilters(averia: Averia, filters: RetrievalFilters): boolean {
  if (filters.status === 'resolved' && !averia.solucionado) return false;
  if (filters.status === 'pending' && averia.solucionado) return false;
  if (filters.tipoAveria && averia.tipoAveria !== filters.tipoAveria) return false;
  if (filters.dateFrom || filters.dateTo) {
    const time = timestampOf(averia);
    if (!time) return false;
    if (filters.dateFrom && time < filters.dateFrom.getTime()) return false;
    if (filters.dateTo && time > filters.dateTo.getTime()) return false;
  }
  return true;
}

export function searchAverias(
  averias: Averia[],
  query: string,
  filters: RetrievalFilters = {},
  limit = 10
): RetrievalMatch[] {
  const queryTokens = Array.from(new Set(tokenize(query)));
  if (queryTokens.length === 0) return [];

  const indexed = averias
    .filter((averia) => passesFilters(averia, filters))
    .map((averia) => {
      const fields = {} as Record<FieldKey, string[]>;
      FIELD_KEYS.forEach((key) => {
        fields[key] = tokenize(String(averia[key] ?? ''));
      });
      return { averia, fields };
    });

  // IDF over the filtered corpus: rarer terms weigh more.
  const idf = new Map<string, number>();
  queryTokens.forEach((token) => {
    const docFrequency = indexed.filter((entry) =>
      FIELD_KEYS.some((key) => tokenMatches(token, entry.fields[key]))
    ).length;
    idf.set(token, Math.log(1 + (indexed.length + 1) / (docFrequency + 1)));
  });

  const scored: (RetrievalMatch & { score: number })[] = [];
  indexed.forEach(({ averia, fields }) => {
    let score = 0;
    const matchedTerms = new Set<string>();
    const matchedFields = new Set<FieldKey>();

    queryTokens.forEach((token) => {
      FIELD_KEYS.forEach((key) => {
        if (tokenMatches(token, fields[key])) {
          score += (idf.get(token) ?? 1) * FIELD_WEIGHTS[key];
          matchedTerms.add(token);
          matchedFields.add(key);
        }
      });
    });

    if (score > 0) {
      scored.push({
        averia,
        matchedTerms: Array.from(matchedTerms),
        matchedFields: Array.from(matchedFields),
        score: averia.solucionado ? score * 1.25 : score,
      });
    }
  });

  return scored
    .sort((a, b) => b.score - a.score || timestampOf(b.averia) - timestampOf(a.averia))
    .slice(0, limit)
    .map(({ averia, matchedTerms, matchedFields }) => ({ averia, matchedTerms, matchedFields }));
}

/** Records for the same chassis number (history of one machine). */
export function relatedHistory(averias: Averia[], numeroBastidor: string, excludeId?: string): Averia[] {
  const key = normalizeText(numeroBastidor).trim();
  if (!key) return [];
  return averias
    .filter((a) => a.id !== excludeId && normalizeText(a.numeroBastidor).trim() === key)
    .sort((a, b) => timestampOf(b) - timestampOf(a));
}
