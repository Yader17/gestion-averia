import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Averia } from '../types/averia';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n';
import { AveriaCard } from '../components/AveriaCard';
import { RetrievalMatch, searchAverias } from '../services/ai/retrieval';
import { askAssistant, type AiAskResponse } from '../services/api/assistantApi';
import { describeApiError } from '../services/api/apiClient';
import { openTechnicalManual } from '../services/api/manualesApi';

type Props = {
  averias: Averia[];
  onOpenAveria: (averia: Averia) => void;
};

type StatusFilter = 'all' | 'resolved' | 'pending';

function stateMessage(
  state: AiAskResponse['ia']['estado'],
  t: (k: TranslationKey, p?: Record<string, string | number>) => string
) {
  switch (state) {
    case 'limite_usuario': return t('ai_state_user_limit');
    case 'limite_global': return t('ai_state_global_limit');
    case 'no_configurada': return t('ai_state_not_configured');
    case 'quota': return t('ai_state_quota');
    case 'unavailable': return t('ai_state_unavailable');
    case 'bad_response': return t('ai_state_bad_response');
    default: return '';
  }
}

export function AssistantScreen({ averias, onOpenAveria }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<AiAskResponse | null>(null);

  const localResults: RetrievalMatch[] = useMemo(
    () => (submitted ? searchAverias(averias, submitted, { status }, 10) : []),
    [averias, submitted, status]
  );
  const byId = useMemo(() => new Map(averias.map((a) => [a.id, a])), [averias]);

  const submit = async () => {
    const q = input.trim();
    setSubmitted(q);
    setError(null);
    setServerResult(null);
    if (!q) return;
    setLoading(true);
    try {
      const result = await askAssistant(q, { status }, language === 'it' ? 'en' : language);
      setServerResult(result);
    } catch (e) {
      setError(describeApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const serverStructured = !!serverResult?.respuesta;
  const fallbackActive = submitted.length > 0 && !loading && (!serverStructured || !!error);
  const relatedCards = serverResult?.relacionadas ?? [];
  const citedManualPages = serverResult?.respuesta?.fuentesManuales ?? [];
  const citedPageKeys = new Set(citedManualPages.map((source) => `${source.manualId}:${source.pagina}`));
  const manualsToShow = (serverResult?.manualesEncontrados ?? []).filter(
    (source) => citedPageKeys.size === 0 || citedPageKeys.has(`${source.manualId}:${source.pagina}`)
  );

  const openManualPage = async (manualId: string, page: number) => {
    try {
      await openTechnicalManual(manualId, page);
    } catch (e) {
      setError(describeApiError(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={26} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">
            {t('ai_title')}
          </Text>
          <Text style={styles.muted}>{t('ai_subtitle')}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => void submit()}
          returnKeyType="search"
          placeholder={t('ai_search_placeholder')}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t('ai_search_placeholder')}
        />
        <Pressable style={styles.searchButton} onPress={() => void submit()} accessibilityRole="button" accessibilityLabel={t('ai_search')}>
          <Ionicons name="search" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={styles.chips}>
        {(['all', 'resolved', 'pending'] as StatusFilter[]).map((option) => (
          <Pressable
            key={option}
            onPress={() => setStatus(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: status === option }}
            style={[styles.chip, status === option && styles.chipActive]}
          >
            <Text style={[styles.chipText, status === option && styles.chipTextActive]}>
              {option === 'all' ? t('ai_filter_all') : option === 'resolved' ? t('status_resolved') : t('status_pending')}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? <Text style={styles.muted}>{t('ai_loading')}</Text> : null}
      {error ? <Text style={styles.alert}>{error}</Text> : null}
      {serverResult && serverResult.ia.estado !== 'ok' ? (
        <View style={styles.notice}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={styles.noticeText}>{stateMessage(serverResult.ia.estado, t)}</Text>
        </View>
      ) : null}
      {fallbackActive ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.noticeText}>{t('ai_fallback_notice')}</Text>
        </View>
      ) : null}

      {submitted ? (
        <View style={styles.answer}>
          {serverStructured ? (
            <>
              <Text style={styles.sectionTitle}>{t('ai_problem_summary')}</Text>
              <Text style={styles.summary}>{serverResult.respuesta?.resumen || t('ai_none_found')}</Text>
              {!serverResult.respuesta?.suficientes ? <Text style={styles.muted}>{t('ai_insufficient')}</Text> : null}

              <Text style={styles.sectionTitle}>{t('ai_background_found')}</Text>
              {serverResult.respuesta?.antecedentes.length ? (
                serverResult.respuesta.antecedentes.map((item) => (
                  <Text style={styles.bullet} key={`a-${item.id}`}>• #{item.id}: {item.motivo}</Text>
                ))
              ) : (
                <Text style={styles.muted}>{t('ai_none_found')}</Text>
              )}

              <Text style={styles.sectionTitle}>{t('ai_possible_causes')}</Text>
              {serverResult.respuesta?.causas.length ? (
                serverResult.respuesta.causas.map((item, idx) => (
                  <Text style={styles.bullet} key={`c-${idx}`}>• {item.texto} ({item.tipo})</Text>
                ))
              ) : (
                <Text style={styles.muted}>{t('ai_none_found')}</Text>
              )}

              <Text style={styles.sectionTitle}>{t('ai_checks_suggested')}</Text>
              {serverResult.respuesta?.comprobaciones.length ? (
                serverResult.respuesta.comprobaciones.map((item, idx) => (
                  <Text style={styles.bullet} key={`k-${idx}`}>• {item.texto} ({item.tipo})</Text>
                ))
              ) : (
                <Text style={styles.muted}>{t('ai_none_found')}</Text>
              )}

              <Text style={styles.sectionTitle}>{t('ai_previous_solutions')}</Text>
              {serverResult.respuesta?.solucionesPrevias.length ? (
                serverResult.respuesta.solucionesPrevias.map((item, idx) => (
                  <Text style={styles.bullet} key={`s-${idx}`}>• {item.texto} (#{item.fuente})</Text>
                ))
              ) : (
                <Text style={styles.muted}>{t('ai_no_solution')}</Text>
              )}

              <Text style={styles.sectionTitle}>{t('ai_internal_sources')}</Text>
              <Text style={styles.muted}>
                {serverResult.respuesta?.antecedentes.map((a) => `#${a.id}`).join(', ') || t('ai_none_found')}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.summary}>
                {localResults.length > 0 ? t('ai_summary', { count: localResults.length, query: submitted }) : t('ai_none_found')}
              </Text>
              {localResults.length > 0 && <Text style={styles.muted}>{t('ai_resolved_first')}</Text>}
            </>
          )}

          {manualsToShow.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>
                {citedPageKeys.size > 0 ? t('ai_manual_sources') : t('ai_manual_matches')}
              </Text>
              {manualsToShow.map((manual) => (
                <View key={`${manual.manualId}:${manual.pagina}`} style={styles.manualSource}>
                  <Text style={styles.whyLabel}>{manual.titulo} · {t('manuals_page_number', { page: manual.pagina })}</Text>
                  {manual.equipo ? <Text style={styles.muted}>{manual.equipo}</Text> : null}
                  <Text style={styles.whyText}>{manual.extracto}</Text>
                  <Pressable
                    style={styles.viewButton}
                    onPress={() => void openManualPage(manual.manualId, manual.pagina)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.viewButtonText}>{t('ai_manual_open', { page: manual.pagina })}</Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}

          {(serverStructured ? relatedCards.length > 0 : localResults.length > 0) ? (
            <>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t('ai_related')}
              </Text>
              {serverStructured
                ? relatedCards.map((card) => {
                    const source = byId.get(card.id);
                    return (
                      <AveriaCard key={card.id} averia={source ?? {
                        id: card.id,
                        fecha: card.fecha,
                        numeroBastidor: card.numeroBastidor,
                        tipoAveria: (card.tipoAveria as Averia['tipoAveria']) || 'Otro',
                        intervencion: card.equipo,
                        lugar: '',
                        observacion: card.registro,
                        solucionado: card.solucionado,
                      }}>
                        <View style={styles.why}>
                          <Text style={styles.whyLabel}>{t('ai_why')}</Text>
                          <Text style={styles.whyText}>{card.motivo}</Text>
                          <Text style={styles.whyLabel}>{t('ai_solution_documented')}</Text>
                          <Text style={styles.whyText}>
                            {source?.observacion || card.registro || t('ai_no_solution')}
                          </Text>
                          <Text style={styles.id}>ID: {card.id}</Text>
                          {source ? (
                            <Pressable style={styles.viewButton} onPress={() => onOpenAveria(source)} accessibilityRole="button">
                              <Text style={styles.viewButtonText}>{t('ai_view_fault')}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </AveriaCard>
                    );
                  })
                : localResults.map((match) => (
                    <AveriaCard key={match.averia.id} averia={match.averia}>
                      <View style={styles.why}>
                        <Text style={styles.whyLabel}>{t('ai_why')}</Text>
                        <Text style={styles.whyText}>{t('ai_why_terms', { terms: match.matchedTerms.join(', ') })}</Text>
                        <Text style={styles.whyLabel}>{t('ai_solution_documented')}</Text>
                        <Text style={styles.whyText}>
                          {match.averia.solucionado && match.averia.observacion
                            ? match.averia.observacion
                            : t('ai_no_solution')}
                        </Text>
                        <Text style={styles.id}>ID: {match.averia.id}</Text>
                        <Pressable
                          style={styles.viewButton}
                          onPress={() => onOpenAveria(match.averia)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.viewButtonText}>{t('ai_view_fault')}</Text>
                        </Pressable>
                      </View>
                    </AveriaCard>
                  ))}
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 96, width: '100%', maxWidth: 900, alignSelf: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text },
    muted: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
    alert: { fontSize: FONT_SIZES.sm, color: COLORS.error },
    notice: {
      flexDirection: 'row',
      gap: SPACING.sm,
      alignItems: 'flex-start',
      backgroundColor: COLORS.primaryLight,
      borderRadius: 10,
      padding: SPACING.md,
    },
    noticeText: { flex: 1, color: COLORS.text, fontSize: FONT_SIZES.md, lineHeight: 20 },
    searchRow: { flexDirection: 'row', gap: SPACING.sm },
    input: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      color: COLORS.text,
      borderRadius: 12,
      paddingHorizontal: SPACING.md,
      fontSize: FONT_SIZES.lg,
    },
    searchButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chips: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    chip: {
      minHeight: 40,
      paddingHorizontal: SPACING.md,
      justifyContent: 'center',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.textSecondary, fontWeight: '600' },
    chipTextActive: { color: COLORS.onPrimary },
    answer: { gap: SPACING.sm },
    summary: { fontSize: FONT_SIZES.lg, color: COLORS.text, fontWeight: '600' },
    sectionTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.sm },
    bullet: { fontSize: FONT_SIZES.md, color: COLORS.text, lineHeight: 20 },
    why: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      backgroundColor: COLORS.surfaceAlt,
      padding: SPACING.md,
      gap: 2,
    },
    manualSource: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: SPACING.md,
      gap: SPACING.xs,
    },
    whyLabel: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4 },
    whyText: { fontSize: FONT_SIZES.md, color: COLORS.text },
    id: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 6 },
    viewButton: {
      marginTop: SPACING.sm,
      minHeight: 44,
      borderRadius: 10,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewButtonText: { color: COLORS.onPrimary, fontWeight: '700' },
  });
