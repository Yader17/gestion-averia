import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import type { ThemeMode } from '../services/preferencesService';
import { clearLocationCache, loadLocationCache } from '../services/storageService';
import { isBackendConfigured } from '../services/api/apiClient';
import { useSupportContact } from '../services/api/publicConfig';
import { useAuth } from '../auth/AuthContext';
import { confirmAction, showMessage } from '../utils/dialogs';

type Props = {
  recordCount: number;
  onOpenAdmin?: () => void;
};

export function SettingsScreen({ recordCount, onOpenAdmin }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors, preferences, updatePreferences } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const auth = useAuth();
  const [cachedLocations, setCachedLocations] = useState<number | null>(null);
  const [renewing, setRenewing] = useState(false);

  const refreshCache = useCallback(() => {
    void loadLocationCache().then((cache) => setCachedLocations(Object.keys(cache).length));
  }, []);

  useEffect(refreshCache, [refreshCache]);

  const supportContact = useSupportContact();
  const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(language) : '—');

  const renew = () =>
    confirmAction(t('settings_account_renew'), t('settings_account_renew_desc'), t('settings_account_renew'), t('common_cancel'), () => {
      setRenewing(true);
      auth
        .renewCode()
        .then((r) => showMessage(t('settings_account_renew'), t('settings_account_renew_done', { code: r.code })))
        .catch((e) => showMessage(t('settings_account_renew'), e instanceof Error ? e.message : String(e)))
        .finally(() => setRenewing(false));
    });

  const logout = () =>
    confirmAction(t('settings_logout'), t('settings_logout_confirm'), t('settings_logout'), t('common_cancel'), () => {
      void auth.logout();
    });
  const clearCache = async () => {
    await clearLocationCache();
    refreshCache();
    showMessage(t('settings_clear_cache'), t('settings_cache_cleared'));
  };

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t('theme_light') },
    { value: 'dark', label: t('theme_dark') },
    { value: 'system', label: t('theme_system') },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('settings_title')}
      </Text>

      <Card title={t('settings_appearance')}>
        <Text style={styles.label}>{t('settings_theme')}</Text>
        <Segmented
          options={themeOptions}
          value={preferences.themeMode}
          onChange={(value) => updatePreferences({ themeMode: value })}
        />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('settings_reduce_motion')}</Text>
            <Text style={styles.hint}>{t('settings_reduce_motion_desc')}</Text>
          </View>
          <Switch
            value={preferences.reduceMotion}
            onValueChange={(value) => updatePreferences({ reduceMotion: value })}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={t('settings_reduce_motion')}
          />
        </View>
      </Card>

      <Card title={t('settings_language')}>
        <Segmented
          options={[
            { value: 'es', label: t('lang_es') },
            { value: 'en', label: t('lang_en') },
          ]}
          value={language}
          onChange={setLanguage}
        />
        <Text style={styles.hint}>{t('settings_language_desc')}</Text>
      </Card>

      <Card title={t('settings_sync')}>
        <Row label={t('settings_sync')} value={isBackendConfigured() ? t('settings_sync_cloud') : t('settings_sync_local')} />
      </Card>

      <Card title={t('settings_storage')}>
        <Row label={t('settings_storage_records')} value={String(recordCount)} />
        <Row label={t('settings_storage_cache')} value={cachedLocations === null ? '…' : String(cachedLocations)} />
        <Pressable style={styles.button} onPress={clearCache} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('settings_clear_cache')}</Text>
        </Pressable>
        <Text style={styles.hint}>{t('settings_clear_cache_desc')}</Text>
      </Card>

      <Card title={t('settings_account')}>
        <Row label={t('settings_account_name')} value={auth.tecnico?.nombre ?? '—'} />
        <Row label={t('settings_account_id')} value={auth.tecnico?.id.slice(0, 8) ?? '—'} />
        <Row label={t('settings_account_role')} value={auth.tecnico ? t(`role_${auth.tecnico.rol}` as const) : '—'} />
        <Row label={t('settings_account_session')} value={formatDate(auth.sessionExpiresAt)} />
        <Row
          label={t('settings_account_code')}
          value={
            auth.codigo
              ? `${formatDate(auth.codigo.expiraEn)} (${t('settings_account_days', { count: auth.codigo.diasRestantes })})`
              : '—'
          }
        />
        <Pressable style={styles.button} onPress={renew} disabled={renewing} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('settings_account_renew')}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={logout} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('settings_logout')}</Text>
        </Pressable>
      </Card>

      {auth.isAdmin && onOpenAdmin ? (
        <Card title={t('settings_admin')}>
          <Pressable style={styles.button} onPress={onOpenAdmin} accessibilityRole="button">
            <Text style={styles.buttonText}>{t('settings_admin_open')}</Text>
          </Pressable>
        </Card>
      ) : null}

      <Card title={t('settings_info')}>
        <Row label={t('settings_version')} value={Constants.expoConfig?.version ?? '—'} />
        <Row label={t('settings_support')} value={supportContact || t('settings_support_unset')} />
      </Card>
    </ScrollView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.cardWrap}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Segmented<T extends string>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {props.options.map((option) => {
        const selected = option.value === props.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => props.onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 96, width: '100%', maxWidth: 720, alignSelf: 'center' },
    heading: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text },
    cardWrap: { gap: SPACING.sm },
    cardTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.md },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    label: { fontSize: FONT_SIZES.md, color: COLORS.text, fontWeight: '600' },
    value: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, flexShrink: 1, textAlign: 'right' },
    hint: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 18 },
    segmented: {
      flexDirection: 'row',
      backgroundColor: COLORS.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 3,
      gap: 3,
    },
    segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    segmentActive: { backgroundColor: COLORS.primary },
    segmentText: { color: COLORS.text, fontWeight: '600', fontSize: FONT_SIZES.md },
    segmentTextActive: { color: COLORS.onPrimary },
    button: {
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { color: COLORS.primary, fontWeight: '700' },
  });
