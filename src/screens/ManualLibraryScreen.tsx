import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { useI18n } from '../i18n/useI18n';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { callApi, describeApiError } from '../services/api/apiClient';
import {
  listTechnicalManuals,
  MAX_MANUAL_BYTES,
  openTechnicalManual,
  uploadTechnicalManual,
  type ManualAsset,
  type TechnicalManual,
} from '../services/api/manualesApi';
import { confirmAction, showMessage } from '../utils/dialogs';

export function ManualLibraryScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [manuales, setManuales] = useState<TechnicalManual[]>([]);
  const [selectedFile, setSelectedFile] = useState<ManualAsset | null>(null);
  const [titulo, setTitulo] = useState('');
  const [equipo, setEquipo] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setManuales(await listTechnicalManuals());
      setError(null);
    } catch (e) {
      setError(describeApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const choosePdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith('.pdf') || (asset.mimeType && asset.mimeType !== 'application/pdf')) {
        showMessage(t('manuals_title'), t('manuals_invalid_pdf'));
        return;
      }
      if (asset.size !== undefined && asset.size !== null && asset.size > MAX_MANUAL_BYTES) {
        showMessage(t('manuals_title'), t('manuals_size_limit'));
        return;
      }
      setSelectedFile(asset);
      setTitulo((previous) => previous || asset.name.replace(/\.pdf$/i, ''));
      setError(null);
    } catch (e) {
      showMessage(t('manuals_title'), describeApiError(e));
    }
  };

  const upload = async () => {
    if (!selectedFile) {
      showMessage(t('manuals_title'), t('manuals_choose_first'));
      return;
    }
    if (!titulo.trim()) {
      showMessage(t('manuals_title'), t('manuals_title_required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadTechnicalManual(selectedFile, titulo.trim(), equipo.trim());
      setSelectedFile(null);
      setTitulo('');
      setEquipo('');
      showMessage(t('manuals_title'), t('manuals_upload_success'));
      await refresh();
    } catch (e) {
      setError(describeApiError(e));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const reindex = async (manual: TechnicalManual) => {
    setBusy(true);
    setError(null);
    try {
      await callApi('manuales.indexar', { id: manual.id });
      showMessage(t('manuals_title'), t('manuals_retry_success'));
      await refresh();
    } catch (e) {
      setError(describeApiError(e));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = (manual: TechnicalManual) => {
    confirmAction(
      t('manuals_delete_title'),
      t('manuals_delete_confirm', { title: manual.titulo }),
      t('common_delete'),
      t('common_cancel'),
      () => {
        void (async () => {
          setBusy(true);
          setError(null);
          try {
            await callApi('manuales.eliminar', { id: manual.id });
            await refresh();
          } catch (e) {
            setError(describeApiError(e));
          } finally {
            setBusy(false);
          }
        })();
      }
    );
  };

  const open = async (manual: TechnicalManual) => {
    try {
      await openTechnicalManual(manual.id);
    } catch (e) {
      setError(describeApiError(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headingRow}>
        <Ionicons name="library-outline" size={28} color={colors.primary} />
        <View style={styles.headingText}>
          <Text style={styles.heading} accessibilityRole="header">{t('manuals_title')}</Text>
          <Text style={styles.muted}>{t('manuals_subtitle')}</Text>
        </View>
      </View>

      {isAdmin ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('manuals_upload_heading')}</Text>
          <TextInput
            style={styles.input}
            value={titulo}
            onChangeText={setTitulo}
            placeholder={t('manuals_title_label')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('manuals_title_label')}
            maxLength={160}
          />
          <TextInput
            style={styles.input}
            value={equipo}
            onChangeText={setEquipo}
            placeholder={t('manuals_equipment_label')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('manuals_equipment_label')}
            maxLength={160}
          />
          <Pressable style={styles.secondaryButton} onPress={() => void choosePdf()} accessibilityRole="button">
            <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>
              {selectedFile ? selectedFile.name : t('manuals_choose_pdf')}
            </Text>
          </Pressable>
          <Text style={styles.muted}>{t('manuals_size_limit')}</Text>
          <Pressable
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={() => void upload()}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryButtonText}>{t('manuals_upload')}</Text>}
          </Pressable>
        </View>
      ) : (
        <Text style={styles.muted}>{t('manuals_read_only')}</Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.listHeading}>
        <Text style={styles.sectionTitle}>{t('manuals_library')}</Text>
        <Pressable onPress={() => void refresh()} accessibilityRole="button" accessibilityLabel={t('manuals_refresh')}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && manuales.length === 0 ? <Text style={styles.muted}>{t('manuals_empty')}</Text> : null}
      {manuales.map((manual) => (
        <View key={manual.id} style={styles.card}>
          <Text style={styles.cardTitle}>{manual.titulo}</Text>
          {manual.equipo ? <Text style={styles.body}>{manual.equipo}</Text> : null}
          <Text style={styles.muted}>
            {manual.estado === 'listo'
              ? t('manuals_pages', { count: manual.paginas })
              : manual.estado === 'pendiente'
                ? t('manuals_state_pending')
                : t('manuals_state_error')}
            {manual.subido_por_nombre ? ` · ${t('manuals_uploaded_by', { name: manual.subido_por_nombre })}` : ''}
          </Text>
          {manual.error_indexacion ? <Text style={styles.error}>{manual.error_indexacion}</Text> : null}
          <View style={styles.actions}>
            {manual.estado === 'listo' ? (
              <Pressable style={styles.secondaryButton} onPress={() => void open(manual)} accessibilityRole="button">
                <Ionicons name="book-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>{t('manuals_read')}</Text>
              </Pressable>
            ) : null}
            {isAdmin && manual.estado !== 'listo' ? (
              <Pressable style={styles.secondaryButton} onPress={() => void reindex(manual)} disabled={busy} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>{t('manuals_retry')}</Text>
              </Pressable>
            ) : null}
            {isAdmin ? (
              <Pressable style={styles.deleteButton} onPress={() => remove(manual)} disabled={busy} accessibilityRole="button">
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.secondaryButtonText, { color: colors.error }]}>{t('manuals_delete')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) => StyleSheet.create({
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 96, width: '100%', maxWidth: 760, alignSelf: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  headingText: { flex: 1, gap: SPACING.xs },
  heading: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.text },
  body: { fontSize: FONT_SIZES.md, color: COLORS.text },
  muted: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20 },
  error: { fontSize: FONT_SIZES.sm, color: COLORS.error, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, color: COLORS.text, borderRadius: 10, paddingHorizontal: SPACING.md, fontSize: FONT_SIZES.md },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
  primaryButtonText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: FONT_SIZES.md },
  secondaryButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, maxWidth: '100%' },
  secondaryButtonText: { color: COLORS.primary, fontWeight: '600', fontSize: FONT_SIZES.sm, flexShrink: 1 },
  deleteButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disabled: { opacity: 0.6 },
});
