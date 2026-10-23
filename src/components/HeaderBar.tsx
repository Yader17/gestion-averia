import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

type HeaderBarProps = {
  totalAverias: number;
  onAddAveria: () => void;
  onImportExcel: () => void;
  onExportExcel: () => void;
  onNewTemplate: () => void;
  isDriveConnected?: boolean;
  userEmail?: string | null;
  cloudSyncError?: string | null;
};

export function HeaderBar({
  totalAverias,
  onAddAveria,
  onImportExcel,
  onExportExcel,
  onNewTemplate,
  isDriveConnected,
  userEmail,
  cloudSyncError,
}: HeaderBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleSection}>
        <Text style={styles.title}>Gestión de Averías</Text>
        <Text style={styles.subtitle}>
          {totalAverias} {totalAverias === 1 ? 'registro' : 'registros'}
        </Text>
        {isDriveConnected && userEmail && (
          <Text style={styles.driveStatus}>☁️ {userEmail}</Text>
        )}
        {cloudSyncError && <Text style={styles.cloudErrorText}>{cloudSyncError}</Text>}
      </View>

      <View style={styles.buttonSection}>
        <Pressable style={styles.newTemplateButton} onPress={onNewTemplate}>
          <Text style={styles.newTemplateButtonText}>🗒️ Nueva Plantilla</Text>
        </Pressable>

        <Pressable style={styles.importButton} onPress={onImportExcel}>
          <Text style={styles.importButtonText}>📂 Importar</Text>
        </Pressable>

        <Pressable style={styles.exportButton} onPress={onExportExcel}>
          <Text style={styles.exportButtonText}>💾 Exportar</Text>
        </Pressable>

        <Pressable style={styles.addButton} onPress={onAddAveria}>
          <Text style={styles.addButtonText}>+ Nueva Avería</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
      },
      default: {
        elevation: 2,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
    }),
  },
  titleSection: {
    flexShrink: 1,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  driveStatus: {
    fontSize: FONT_SIZES.sm - 2,
    color: COLORS.primary,
    marginTop: 2,
  },
  cloudErrorText: {
    fontSize: FONT_SIZES.sm - 2,
    color: COLORS.error,
    marginTop: 4,
    maxWidth: 360,
  },
  buttonSection: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
  importButton: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  importButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
  exportButton: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
  newTemplateButton: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  newTemplateButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
});
