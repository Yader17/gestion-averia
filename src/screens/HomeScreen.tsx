import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { AveriaTable } from '../components/AveriaTable';
import { AveriaFormModal } from '../components/AveriaFormModal';
import { HeaderBar } from '../components/HeaderBar';
import {
  DateSortOrder,
  FilterBar,
  SolucionadoFilter,
} from '../components/FilterBar';
import { TabPills } from '../components/TabPills';
import { KPIDashboard } from '../components/KPIDashboard';
import { AveriasMapView } from '../components/AveriasMapView';
import { ImportSourceModal } from '../components/ImportSourceModal';
import { DriveFilePickerModal } from '../components/DriveFilePickerModal';
import { useAverias } from '../hooks/useAverias';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { parseExcelBuffer, exportToExcelBuffer } from '../services/excelService';
import {
  loadCustomIntervencionTypes,
  saveCustomIntervencionTypes,
} from '../services/storageService';
import {
  saveCloudCustomIntervencionTypes,
  subscribeToCloudSettings,
} from '../services/cloudSyncService';
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
import { COLORS } from '../constants/theme';
import { parseDate } from '../utils/dateUtils';

export function HomeScreen() {
  const { averias, cloudSyncError, addAveria, updateAveria, deleteAveria, setAverias, clearAverias } =
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
  const [activeTab, setActiveTab] = useState('datos');

  // Load custom intervención types on mount
  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    loadCustomIntervencionTypes().then((types) => {
      if (!isActive) {
        return;
      }

      setCustomIntervencionTypes(types);
    });

    void subscribeToCloudSettings(
      async (settings) => {
        if (!isActive) {
          return;
        }

        setCustomIntervencionTypes(settings.customIntervencionTypes);
        await saveCustomIntervencionTypes(settings.customIntervencionTypes);
      },
      (error) => {
        console.error('Cloud settings subscription error:', error);
      }
    ).then((nextUnsubscribe) => {
      if (!isActive) {
        nextUnsubscribe();
        return;
      }

      unsubscribe = nextUnsubscribe;
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  const handleAddCustomIntervencion = useCallback((name: string) => {
    setCustomIntervencionTypes((prev) => {
      if (prev.includes(name)) return prev;
      const updated = [...prev, name].sort();
      void saveCustomIntervencionTypes(updated);
      void saveCloudCustomIntervencionTypes(updated);
      return updated;
    });
  }, []);

  const handleDeleteCustomIntervencion = useCallback((name: string) => {
    setCustomIntervencionTypes((prev) => {
      const updated = prev.filter((t) => t !== name);
      void saveCustomIntervencionTypes(updated);
      void saveCloudCustomIntervencionTypes(updated);
      return updated;
    });
  }, []);

  const handleNewTemplate = useCallback(() => {
    const doReset = () => {
      void clearAverias();
      showAlert('Nueva plantilla', 'Se ha creado una plantilla vacía. Los datos anteriores se han eliminado.');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Crear una plantilla nueva? Se eliminarán todos los datos actuales.')) {
        doReset();
      }
    } else {
      Alert.alert(
        'Nueva Plantilla',
        '¿Crear una plantilla nueva? Se eliminarán todos los datos actuales.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Crear', style: 'destructive', onPress: doReset },
        ]
      );
    }
  }, [clearAverias]);

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
    setActiveTab('datos');
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
        if (averiaToDelete) {
          await deleteAveriaPhotos(getAveriaPhotos(averiaToDelete));
        }
        deleteAveria(id);
      };

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
    [averias, deleteAveria]
  );

  const handleFormSubmit = useCallback(
    async (data: AveriaFormData) => {
      try {
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
    [editingAveria, updateAveria, addAveria]
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
      void setAverias(parsedAverias);

      const importMessage = sourceName
        ? `Se cargaron ${parsedAverias.length} registros desde "${sourceName}". Las ubicaciones reales se completaran en segundo plano.`
        : `Se cargaron ${parsedAverias.length} registros. Las ubicaciones reales se completaran en segundo plano.`;

      showAlert('Importación iniciada', importMessage);

      void hydrateAveriasLocations(parsedAverias)
        .then((hydrated) => {
          if (hydrated.resolvedCount === 0 && hydrated.unresolvedCount === 0) {
            return;
          }

          void setAverias(hydrated.averias);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          showAlert(
            'Importación parcial',
            `Los registros se importaron, pero no se pudieron completar las ubicaciones reales. ${message}`
          );
        });
    },
    [setAverias]
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

  return (
    <View style={styles.container}>
      <HeaderBar
        totalAverias={averias.length}
        onAddAveria={handleAddAveria}
        onImportExcel={handleOpenImportModal}
        onExportExcel={handleExportExcel}
        onNewTemplate={handleNewTemplate}
        isDriveConnected={isDriveConnected}
        userEmail={userEmail}
      />

      <TabPills
        tabs={[
          { key: 'datos', label: '📋 Datos' },
          { key: 'kpis', label: '📊 KPIs' },
          { key: 'mapa', label: '🗺️ Mapa' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'datos' ? (
        <>
          <FilterBar
            searchText={searchText}
            onSearchTextChange={setSearchText}
            solucionadoFilter={solucionadoFilter}
            onSolucionadoFilterChange={setSolucionadoFilter}
            dateSortOrder={dateSortOrder}
            onDateSortOrderChange={setDateSortOrder}
            resultCount={filteredAverias.length}
            totalCount={averias.length}
          />

          <View style={styles.tableContainer}>
            <AveriaTable
              averias={filteredAverias}
              onEditAveria={handleEditAveria}
              onDeleteAveria={handleDeleteAveria}
              onGenerateReport={handleGenerateReport}
            />
          </View>
        </>
      ) : activeTab === 'kpis' ? (
        <KPIDashboard averias={averias} />
      ) : (
        <AveriasMapView
          averias={averias}
          onViewRecords={handleViewBastidorRecords}
        />
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tableContainer: {
    flex: 1,
    padding: 16,
  },
});
