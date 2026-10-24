import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import { useAuth } from '../auth/AuthContext';
import { describeApiError, isBackendConfigured } from '../services/api/apiClient';
import { useSupportContact } from '../services/api/publicConfig';

export function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { login } = useAuth();
  const contact = useSupportContact();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const submit = async () => {
    if (!code.trim()) {
      setError(t('login_empty'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(code);
    } catch (e) {
      setError(describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoPlate}>
          <Image source={require('../../assets/app-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel={t('appName')} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t('login_title')}
        </Text>
        <Text style={styles.subtitle}>{t('login_subtitle')}</Text>

        {!isBackendConfigured() ? <Text style={styles.error}>{t('login_not_configured')}</Text> : null}

        <Text style={styles.label}>{t('login_code_label')}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          secureTextEntry
          maxLength={40}
          onSubmitEditing={submit}
          accessibilityLabel={t('login_code_label')}
        />
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('login_submit')}</Text>}
        </Pressable>

        <Pressable onPress={() => setShowHelp((v) => !v)} accessibilityRole="button" style={styles.helpLink}>
          <Text style={styles.helpLinkText}>{t('login_need_code')}</Text>
        </Pressable>
        {showHelp ? (
          <View style={styles.help}>
            <Text style={styles.helpText}>{t('login_need_code_body')}</Text>
            <Text style={styles.contact} selectable>
              {contact || t('login_contact_unset')}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: COLORS.background },
    content: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg, gap: SPACING.sm, width: '100%', maxWidth: 440, alignSelf: 'center' },
    logoPlate: { alignSelf: 'center', backgroundColor: COLORS.logoPlate, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.md },
    logo: { width: 160, height: 64 },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
    subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.md },
    label: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textSecondary },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      color: COLORS.text,
      borderRadius: 10,
      paddingHorizontal: SPACING.md,
      fontSize: FONT_SIZES.lg,
      letterSpacing: 1,
    },
    error: { color: COLORS.error, fontSize: FONT_SIZES.sm },
    button: { minHeight: 52, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
    disabled: { opacity: 0.6 },
    buttonText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: FONT_SIZES.md },
    helpLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    helpLinkText: { color: COLORS.primary, fontWeight: '600', textDecorationLine: 'underline' },
    help: { backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.xs },
    helpText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, lineHeight: 18 },
    contact: { color: COLORS.text, fontWeight: '700', fontSize: FONT_SIZES.md },
  });

