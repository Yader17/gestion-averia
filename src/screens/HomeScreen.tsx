import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, BackHandler, Pressable, Text, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { AveriaFormModal } from '../components/AveriaFormModal';
import { DateSortOrder, SolucionadoFilter } from '../components/FilterBar';
import { KPIDashboard } from '../components/KPIDashboard';
import { AveriasMapView } from '../components/AveriasMapView';
import { ImportSourceModal } from '../components/ImportSourceModal';
import { DriveFilePickerModal } from '../components/DriveFilePickerModal';
import { useAverias } from '../hooks/useAverias';
import { BottomNavBar, DESKTOP_BREAKPOINT, SectionKey } from '../navigation/BottomNavBar';
import { DashboardScreen } from './DashboardScreen';
import { FaultsScreen } from './FaultsScreen';
import { AssistantScreen } from './AssistantScreen';
import { MoreAction, MoreScreen } from './MoreScreen';
import { SettingsScreen } from './SettingsScreen';
import { useI18n } from '../i18n/useI18n';
import { confirmAction } from '../utils/dialogs';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { parseExcelBuffer, exportToExcelBuffer } from '../services/excelService';
import {
  loadCustomIntervencionTypes,
  saveCustomIntervencionTypes,
} from '../services/storageService';
import { callApi, describeApiError } from '../services/api/apiClient';
import { useAuth } from '../auth/AuthContext';
import { AdminScreen } from './AdminScreen';
import {
  deleteAveriaPhotos,
  persistAveriaPhotos,
} from '../services/photoService';
import { exportAveriaReportPdf } from '../services/pdfReportService';
import {
  downloadDriveFile,
  DriveFileInfo,
} from '../services/googleDriveService';
import { hydrateAveriasLocations } from '../services/geocodingService';
import { Averia, AveriaFormData, getAveriaPhotos } from '../types/averia';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { parseDate } from '../utils/dateUtils';

export function HomeScreen({ onReady }: { onReady?: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { averias, isLoaded, cloudSyncError, refresh, addAveria, updateAveria, deleteAveria, setAverias, clearAverias } =
    useAverias();

  const {
    accessToken,
    isConnected: isDriveConnected,
    isLoading: isAuthLoading,
    userEmail,
    signIn,
    signOut,
  } = useGoogleAuth();

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingAveria, setEditingAveria] = useState<Averia | null>(null);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [isDrivePickerVisible, setIsDrivePickerVisible] = useState(false);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [solucionadoFilter, setSolucionadoFilter] = useState<SolucionadoFilter>('todos');
  const [dateSortOrder, setDateSortOrder] = useState<DateSortOrder>('desc');
  const [customIntervencionTypes, setCustomIntervencionTypes] = useState<string[]>([]);
  useEffect(() => {
    if (isLoaded) onReady?.();
  }, [isLoaded, onReady]);

  const { canWrite, isAdmin, codigo } = useAuth();
  const [section, setSection] = useState<SectionKey>('home');
  const [moreRoute, setMoreRoute] = useState<'menu' | 'kpis' | 'settings' | 'admin'>('menu');
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  // Tipos de intervencion personalizados: compartidos desde el servidor, con copia local de respaldo.
  useEffect(() => {
    let isActive = true;
    loadCustomIntervencionTypes().then((types) => {
      if (isActive) setCustomIntervencionTypes(types);
    });
    callApi<{ tiposIntervencion: string[] }>('tipos.get')
      .then(async (r) => {
        if (!isActive) return;
        setCustomIntervencionTypes(r.tiposIntervencion);
        await saveCustomIntervencionTypes(r.tiposIntervencion);
      })
      .catch((error) => console.error('Tipos de intervencion:', error));
    return () => {
      isActive = false;
    };
  }, []);

  const persistCustomTypes = useCallback((updated: string[]) => {
    void saveCustomIntervencionTypes(updated);
    callApi('tipos.set', { tiposIntervencion: updated }).catch((error) =>
      showAlert('Error', describeApiError(error))
    );
  }, []);

  const handleAddCustomIntervencion = useCallback((name: string) => {
    setCustomIntervencionTypes((prev) => {
      if (prev.includes(name)) return prev;
      const updated = [...prev, name].sort();
      persistCustomTypes(updated);
      return updated;
    });
  }, []);

  const handleDeleteCustomIntervencion = useCallback((name: string) => {
    setCustomIntervencionTypes((prev) => {
      const updated = prev.filter((t) => t !== name);
      persistCustomTypes(updated);
      return updated;
    });
  }, []);

  const handleNewTemplate = useCallback(() => {
    if (!isAdmin) {
      showAlert('Sin permisos', 'Solo un administrador puede vaciar los datos compartidos.');
      return;
    }

    const doReset = () => {
      clearAverias()
        .then(() =>
          showAlert('Nueva plantilla', 'Se ha creado una plantilla vacía. Los registros eliminados quedan en el historial de auditoría del servidor.')
        )
        .catch((error) => showAlert('Error', describeApiError(error)));
    };

    const message =
      '¿Crear una plantilla nueva? Se eliminarán TODAS las averías compartidas por todos los técnicos. Esta acción afecta a todos los dispositivos.';

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        doReset();
      }
    } else {
      Alert.alert('Nueva Plantilla', message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Crear', style: 'destructive', onPress: doReset },
      ]);
    }
  }, [clearAverias, isAdmin]);

  const filteredAverias = useMemo(() => {
    let result = averias;

    if (searchText.trim()) {
      const term = searchText.toLowerCase().trim();
      result = result.filter((a) =>
        a.fecha.toLowerCase().includes(term) ||
        a.numeroBastidor.toLowerCase().includes(term) ||
        a.tipoAveria.toLowerCase().includes(term) ||
        a.intervencion.toLowerCase().includes(term) ||
        a.lugar.toLowerCase().includes(term) ||
        a.observacion.toLowerCase().includes(term)
      );
    }

    if (solucionadoFilter !== 'todos') {
      const isSolved = solucionadoFilter === 'si';
      result = result.filter((a) => a.solucionado === isSolved);
    }

    return [...result].sort((left, right) => {
      const leftTimestamp = getFechaTimestamp(left.fecha);
      const rightTimestamp = getFechaTimestamp(right.fecha);

      if (leftTimestamp === rightTimestamp) {
        return 0;
      }

      if (dateSortOrder === 'asc') {
        return leftTimestamp - rightTimestamp;
      }

      return rightTimestamp - leftTimestamp;
    });
  }, [averias, searchText, solucionadoFilter, dateSortOrder]);

  const handleViewBastidorRecords = useCallback((bastidor: string) => {
    if (!bastidor.trim()) {
      return;
    }

    setSearchText(bastidor);
    setSection('faults');
  }, []);

  const handleAddAveria = useCallback(() => {
    setEditingAveria(null);
    setIsFormVisible(true);
  }, []);

  const handleEditAveria = useCallback((averia: Averia) => {
    setEditingAveria(averia);
    setIsFormVisible(true);
  }, []);

  const handleDeleteAveria = useCallback(
    (id: string) => {
      const averiaToDelete = averias.find((averia) => averia.id === id);

      const confirmDelete = async () => {
        try {
          await deleteAveria(id);
          if (averiaToDelete) {
            await deleteAveriaPhotos(getAveriaPhotos(averiaToDelete));
          }
        } catch (error) {
          showAlert('No se pudo eliminar', describeApiError(error instanceof Error ? error : new Error(String(error))));
        }
      };

      if (!isAdmin) {
        showAlert('Sin permisos', 'Solo un administrador puede eliminar averías.');
        return;
      }

      if (Platform.OS === 'web') {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta avería?')) {
          void confirmDelete();
        }
      } else {
        Alert.alert(
          'Confirmar eliminación',
          '¿Estás seguro de que quieres eliminar esta avería?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Eliminar',
              style: 'destructive',
              onPress: () => {
                void confirmDelete();
              },
            },
          ]
        );
      }
    },
    [averias, deleteAveria, isAdmin]
  );

  const handleFormSubmit = useCallback(
    async (data: AveriaFormData) => {
      try {
        if (!canWrite) {
          throw new Error('Tu rol es de solo consulta: no puedes modificar averías.');
        }
        const persistedPhotos = await persistAveriaPhotos(data.fotos);
        const payload: AveriaFormData = {
          ...data,
          fotos: persistedPhotos,
        };

        if (editingAveria) {
          const previousPhotos = getAveriaPhotos(editingAveria);
          const removedPhotos = previousPhotos.filter(
            (photo) => !persistedPhotos.some((nextPhoto) => nextPhoto.uri === photo.uri)
          );

          await deleteAveriaPhotos(removedPhotos);
          await updateAveria(editingAveria.id, payload);
          return;
        }

        await addAveria(payload);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error desconocido';
        showAlert('Error al guardar', message);
        throw error;
      }
    },
    [editingAveria, updateAveria, addAveria, canWrite]
  );

  const handleGenerateReport = useCallback(async (averia: Averia) => {
    try {
      const fileUri = await exportAveriaReportPdf({
        ...averia,
        fotos: getAveriaPhotos(averia),
      });

      if (fileUri) {
        showAlert('Reporte generado', `PDF creado en: ${fileUri}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      showAlert('Error al generar el reporte', message);
    }
  }, []);

  const handleOpenImportModal = useCallback(() => {
    setIsImportModalVisible(true);
  }, []);

  const applyImportedAverias = useCallback(
    (parsedAverias: Averia[], sourceName?: string) => {
      if (!canWrite) {
        showAlert('Sin permisos', 'Tu rol es de solo consulta.');
        return;
      }

      setAverias(parsedAverias)
        .then(() => {
          const importMessage = sourceName
            ? `Se procesaron ${parsedAverias.length} registros desde "${sourceName}". Se añadieron los nuevos; no se eliminó ningún registro existente.`
            : `Se procesaron ${parsedAverias.length} registros. Se añadieron los nuevos; no se eliminó ningún registro existente.`;
          showAlert('Importación completada', importMessage);

          return hydrateAveriasLocations(parsedAverias).then((hydrated) => {
            if (hydrated.resolvedCount === 0 && hydrated.unresolvedCount === 0) {
              return;
            }

            return setAverias(hydrated.averias);
          });
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          showAlert('Importación incompleta', message);
        });
    },
    [setAverias, canWrite]
  );

  const handleImportLocal = useCallback(async () => {
    try {
      const pickerTypes = Platform.OS === 'web'
        ? [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel.sheet.macroEnabled.12',
            'application/vnd.ms-excel',
          ]
        : ['*/*'];

      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes,
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const selectedAsset = result.assets[0];
      const fileUri = selectedAsset.uri;
      const fileName = selectedAsset.name || fileUri.split('/').pop() || '';

      if (!isExcelLikeFile(fileName, selectedAsset.mimeType)) {
        showAlert('Archivo no válido', 'Selecciona un archivo Excel .xlsx, .xlsm o .xls.');
        return;
      }

      let buffer: ArrayBuffer;

      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        buffer = await response.arrayBuffer();
      } else {
        const base64 = await LegacyFileSystem.readAsStringAsync(fileUri, {
          encoding: LegacyFileSystem.EncodingType.Base64,
        });
        buffer = base64ToArrayBuffer(base64);
      }

      const parsedAverias = parseExcelBuffer(buffer);

      if (parsedAverias.length === 0) {
        showAlert('Sin datos', 'No se encontraron registros en el archivo.');
        return;
      }

      applyImportedAverias(parsedAverias);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      showAlert('Error al importar', message);
    }
  }, [applyImportedAverias]);

  const handleImportDrive = useCallback(async () => {
    if (!isDriveConnected) {
      await signIn();
      // After sign-in completes, show the Drive picker
      setIsDrivePickerVisible(true);
      return;
    }
    setIsDrivePickerVisible(true);
  }, [isDriveConnected, signIn]);

  const handleDriveFileSelected = useCallback(
    async (file: DriveFileInfo) => {
      setIsDrivePickerVisible(false);

      if (!accessToken) {
        showAlert('Error', 'No se pudo autenticar con Google Drive.');
        return;
      }

      try {
        showAlert('Descargando...', `Descargando "${file.name}" desde Drive...`);

        const buffer = await downloadDriveFile(accessToken, file.id);
        const parsedAverias = parseExcelBuffer(buffer);

        if (parsedAverias.length === 0) {
          showAlert('Sin datos', 'No se encontraron registros en el archivo.');
          return;
        }

        setDriveFileId(file.id);
        applyImportedAverias(parsedAverias, file.name);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error desconocido';
        showAlert('Error al importar desde Drive', message);
      }
    },
    [accessToken, applyImportedAverias]
  );

  const handleExportExcel = useCallback(async () => {
    try {
      if (averias.length === 0) {
        showAlert('Sin datos', 'No hay averías para exportar.');
        return;
      }

      const buffer = exportToExcelBuffer(averias);

      if (Platform.OS === 'web') {
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Gestion_Averias.xlsx';
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const base64 = arrayBufferToBase64(buffer);
        const fileUri = `${LegacyFileSystem.documentDirectory}Gestion_Averias.xlsx`;

        await LegacyFileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: LegacyFileSystem.EncodingType.Base64,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar Gestión de Averías',
          });
        } else {
          showAlert('Exportado', `Archivo guardado en: ${fileUri}`);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      showAlert('Error al exportar', message);
    }
  }, [averias]);

  const handleNavChange = useCallback((key: SectionKey) => {
    setSection(key);
    if (key === 'more') setMoreRoute('menu');
  }, []);

  const handleViewAll = useCallback((filter?: 'pending' | 'resolved') => {
    setSolucionadoFilter(filter === 'pending' ? 'no' : filter === 'resolved' ? 'si' : 'todos');
    setSearchText('');
    setSection('faults');
  }, []);

  const handleMoreAction = useCallback(
    (action: MoreAction) => {
      switch (action) {
        case 'kpis':
          setMoreRoute('kpis');
          break;
        case 'settings':
          setMoreRoute('settings');
          break;
        case 'templates':
          handleNewTemplate();
          break;
        case 'import':
          handleOpenImportModal();
          break;
        case 'export':
          void handleExportExcel();
          break;
      }
    },
    [handleNewTemplate, handleOpenImportModal, handleExportExcel]
  );

  // Android hardware back: close sub-screen, then return to Home, then default behaviour.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (section === 'more' && moreRoute !== 'menu') {
        setMoreRoute('menu');
        return true;
      }
      if (section !== 'home') {
        setSection('home');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [section, moreRoute]);

  const inSubRoute = section === 'more' && moreRoute !== 'menu';
  const showNewButton = canWrite && (section === 'home' || section === 'faults' || section === 'map');

  let content: React.ReactNode;
  switch (section) {
    case 'home':
      content = (
        <DashboardScreen
          averias={averias}
          onOpenAveria={handleEditAveria}
          onNewAveria={handleAddAveria}
          onViewAll={handleViewAll}
        />
      );
      break;
    case 'faults':
      content = (
        <FaultsScreen
          averias={filteredAverias}
          totalCount={averias.length}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          solucionadoFilter={solucionadoFilter}
          onSolucionadoFilterChange={setSolucionadoFilter}
          dateSortOrder={dateSortOrder}
          onDateSortOrderChange={setDateSortOrder}
          onEditAveria={handleEditAveria}
          onDeleteAveria={isAdmin ? handleDeleteAveria : undefined}
          onGenerateReport={handleGenerateReport}
        />
      );
      break;
    case 'map':
      content = <AveriasMapView averias={averias} onViewRecords={handleViewBastidorRecords} />;
      break;
    case 'ai':
      content = <AssistantScreen averias={averias} onOpenAveria={handleEditAveria} />;
      break;
    default:
      content =
        moreRoute === 'kpis' ? (
          <KPIDashboard averias={averias} />
        ) : moreRoute === 'settings' ? (
          <SettingsScreen recordCount={averias.length} onOpenAdmin={() => setMoreRoute('admin')} />
        ) : moreRoute === 'admin' ? (
          <AdminScreen onDataChanged={() => void refresh()} />
        ) : (
          <MoreScreen onAction={handleMoreAction} />
        );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        {inSubRoute ? (
          <Pressable
            onPress={() => setMoreRoute('menu')}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('common_back')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
        ) : null}
        <Text style={styles.topTitle} numberOfLines={1} accessibilityRole="header">
          {t('appName')}
        </Text>
        <Text style={styles.topMeta}>{t('common_records', { count: averias.length })}</Text>
      </View>
      {cloudSyncError ? <Text style={styles.syncError}>{cloudSyncError}</Text> : null}
      {codigo?.aviso ? (
        <Pressable
          onPress={() => {
            setSection('more');
            setMoreRoute('settings');
          }}
          accessibilityRole="button"
        >
          <Text style={styles.syncError}>{t('banner_code_expiring', { count: codigo.diasRestantes })}</Text>
        </Pressable>
      ) : null}
      {!canWrite ? <Text style={styles.syncError}>{t('readonly_notice')}</Text> : null}

      <View style={styles.content}>
        {content}
        {showNewButton && (
          <Pressable
            style={[styles.fab, isDesktop && styles.fabDesktop]}
            onPress={handleAddAveria}
            accessibilityRole="button"
            accessibilityLabel={t('nav_new_fault')}
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
            {isDesktop && <Text style={styles.fabLabel}>{t('nav_new_fault')}</Text>}
          </Pressable>
        )}
      </View>

      <BottomNavBar active={section} onChange={handleNavChange} />

      <AveriaFormModal
        visible={isFormVisible}
        onClose={() => setIsFormVisible(false)}
        onSubmit={handleFormSubmit}
        initialData={editingAveria}
        customIntervencionTypes={customIntervencionTypes}
        onAddCustomIntervencion={handleAddCustomIntervencion}
        onDeleteCustomIntervencion={handleDeleteCustomIntervencion}
      />

      <ImportSourceModal
        visible={isImportModalVisible}
        onClose={() => setIsImportModalVisible(false)}
        onImportLocal={() => {
          setIsImportModalVisible(false);
          handleImportLocal();
        }}
        onImportDrive={() => {
          setIsImportModalVisible(false);
          handleImportDrive();
        }}
        isDriveConnected={isDriveConnected}
      />

      <DriveFilePickerModal
        visible={isDrivePickerVisible}
        accessToken={accessToken}
        onClose={() => setIsDrivePickerVisible(false)}
        onFileSelected={handleDriveFileSelected}
      />
    </View>
  );
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function isExcelLikeFile(fileName: string, mimeType?: string | null): boolean {
  const normalizedName = fileName.toLowerCase();
  const normalizedMime = String(mimeType || '').toLowerCase();

  if (
    normalizedName.endsWith('.xlsx') ||
    normalizedName.endsWith('.xlsm') ||
    normalizedName.endsWith('.xls')
  ) {
    return true;
  }

  return [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroenabled.12',
    'application/vnd.ms-excel',
    'application/octet-stream',
  ].includes(normalizedMime);
}

function getFechaTimestamp(fecha: string): number {
  const parsed = parseDate(fecha);
  if (parsed) {
    return parsed.getTime();
  }

  return 0;
}

function buildImportSummaryMessage(
  totalCount: number,
  resolvedCount: number,
  unresolvedCount: number
): string {
  const parts = [`Se cargaron ${totalCount} registros.`];

  if (resolvedCount > 0) {
    parts.push(`Se reconocieron ${resolvedCount} ubicación(es) automáticamente desde el campo Lugar.`);
  }

  if (unresolvedCount > 0) {
    parts.push(`${unresolvedCount} registro(s) quedaron solo como texto y podrían requerir ajuste manual.`);
  }

  return parts.join(' ');
}

const createStyles = (COLORS: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.primary },
  topMeta: { fontSize: 13, color: COLORS.textSecondary },
  syncError: {
    backgroundColor: COLORS.errorSoft,
    color: COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    minWidth: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabDesktop: { paddingHorizontal: 20, right: 32, bottom: 24 },
  fabLabel: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },
});
