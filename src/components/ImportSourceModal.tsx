import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

type ImportSourceModalProps = {
  visible: boolean;
  onClose: () => void;
  onImportLocal: () => void;
  onImportDrive: () => void;
  isDriveConnected: boolean;
};

export function ImportSourceModal({
  visible,
  onClose,
  onImportLocal,
  onImportDrive,
  isDriveConnected,
}: ImportSourceModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Importar datos</Text>
          <Text style={styles.subtitle}>
            Selecciona de dónde quieres cargar el archivo Excel
          </Text>

          <View style={styles.optionsContainer}>
            {/* Local file option */}
            <Pressable
              style={styles.optionCard}
              onPress={() => {
                onClose();
                onImportLocal();
              }}
            >
              <Text style={styles.optionIcon}>📂</Text>
              <Text style={styles.optionTitle}>Archivo local</Text>
              <Text style={styles.optionDescription}>
                Selecciona un archivo Excel (.xlsx / .xlsm) desde tu dispositivo
              </Text>
            </Pressable>

            {/* Google Drive option */}
            <Pressable
              style={[styles.optionCard, styles.driveCard]}
              onPress={() => {
                onClose();
                onImportDrive();
              }}
            >
              <Text style={styles.optionIcon}>☁️</Text>
              <Text style={styles.optionTitle}>Google Drive</Text>
              <Text style={styles.optionDescription}>
                {isDriveConnected
                  ? 'Descarga el archivo desde tu Google Drive'
                  : 'Conecta tu cuenta de Google para importar'}
              </Text>
              {!isDriveConnected && (
                <View style={styles.connectBadge}>
                  <Text style={styles.connectBadgeText}>Requiere conexión</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 440,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      },
      default: {
        elevation: 10,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
    }),
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  optionsContainer: {
    gap: SPACING.sm,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  driveCard: {
    borderColor: '#4285F4',
    borderWidth: 1.5,
  },
  optionIcon: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  optionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  optionDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  connectBadge: {
    marginTop: SPACING.sm,
    backgroundColor: '#e8f0fe',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  connectBadgeText: {
    fontSize: FONT_SIZES.sm,
    color: '#4285F4',
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
