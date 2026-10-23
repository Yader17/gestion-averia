import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Averia } from '../types/averia';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import { AveriaCard } from '../components/AveriaCard';
import { RetrievalMatch, searchAverias } from '../services/ai/retrieval';

type Props = {
  averias: Averia[];
  onOpenAveria: (averia: Averia) => void;
};

type StatusFilter = 'all' | 'resolved' | 'pending';

// Local-retrieval mode: the generative provider (Gemini via secure backend) is not connected yet.
export function AssistantScreen({ averias, onOpenAveria }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const results: RetrievalMatch[] = useMemo(
    () => (submitted ? searchAverias(averias, submitted, { status }, 10) : []),
    [averias, submitted, status]
  );

  const submit = () => setSubmitted(input.trim());

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

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.noticeText}>{t('ai_mode_notice')}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
          returnKeyType="search"
          placeholder={t('ai_search_placeholder')}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t('ai_search_placeholder')}
        />
        <Pressable style={styles.searchButton} onPress={submit} accessibilityRole="button" accessibilityLabel={t('ai_search')}>
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

      {submitted ? (
        <View style={styles.answer}>
          <Text style={styles.summary}>
            {results.length > 0
              ? t('ai_summary', { count: results.length, query: submitted })
              : t('ai_none_found')}
          </Text>
          {results.length > 0 && <Text style={styles.muted}>{t('ai_resolved_first')}</Text>}

          {results.length > 0 && (
            <>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t('ai_related')}
              </Text>
              {results.map((match) => (
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
          )}
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
    why: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      backgroundColor: COLORS.surfaceAlt,
      padding: SPACING.md,
      gap: 2,
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
