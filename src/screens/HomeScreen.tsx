import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { AveriaTable } from '../components/AveriaTable';
import { AveriaFormModal } from '../components/AveriaFormModal';
import { HeaderBar } from '../components/HeaderBar';
import { FilterBar, SolucionadoFilter } from '../components/FilterBar';
import { TabPills } from '../components/TabPills';
import { KPIDashboard } from '../components/KPIDashboard';
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
  downloadDriveFile,
  DriveFileInfo,
} from '../services/googleDriveService';
import { Averia, AveriaFormData } from '../types/averia';
import { COLORS } from '../constants/theme';

export function HomeScreen() {
  const { averias, addAveria, updateAveria, deleteAveria, setAverias, clearAverias } =
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
  const [customIntervencionTypes, setCustomIntervencionTypes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('datos');

  // Load custom intervención types on mount
  useEffect(() => {
    loadCustomIntervencionTypes().then(setCustomIntervencionTypes);
  }, []);

  const handleAddCustomIntervencion = useCallback((name: string) => {
    setCustomIntervencionTypes((prev) => {
      if (prev.includes(name)) return prev;
      const updated = [...prev, name].sort();
      saveCustomIntervencionTypes(updated);
      return updated;
    });
  }, []);

  const handleDeleteCustomIntervencion = useCallback((name: string) => {
    setCustomIntervencionTypes((prev) => {
      const updated = prev.filter((t) => t !== name);
      saveCustomIntervencionTypes(updated);
      return updated;
    });
  }, []);

  const handleNewTemplate = useCallback(() => {
    const doReset = () => {
      clearAverias();
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

    return result;
  }, [averias, searchText, solucionadoFilter]);

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
      if (Platform.OS === 'web') {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta avería?')) {
          deleteAveria(id);
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
              onPress: () => deleteAveria(id),
            },
          ]
        );
      }
    },
    [deleteAveria]
  );

  const handleFormSubmit = useCallback(
    (data: AveriaFormData) => {
      if (editingAveria) {
        updateAveria(editingAveria.id, data);
      } else {
        addAveria(data);
      }
    },
    [editingAveria, updateAveria, addAveria]
  );

  const handleOpenImportModal = useCallback(() => {
    setIsImportModalVisible(true);
  }, []);

  const handleImportLocal = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel.sheet.macroEnabled.12',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const fileUri = result.assets[0].uri;
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

      setAverias(parsedAverias);
      showAlert(
        'Importación exitosa',
        `Se cargaron ${parsedAverias.length} registros.`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      showAlert('Error al importar', message);
    }
  }, [setAverias]);

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
        setAverias(parsedAverias);
        showAlert(
          'Importación exitosa',
          `Se cargaron ${parsedAverias.length} registros desde "${file.name}".`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error desconocido';
        showAlert('Error al importar desde Drive', message);
      }
    },
    [accessToken, setAverias]
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
            resultCount={filteredAverias.length}
            totalCount={averias.length}
          />

          <View style={styles.tableContainer}>
            <AveriaTable
              averias={filteredAverias}
              onEditAveria={handleEditAveria}
              onDeleteAveria={handleDeleteAveria}
            />
          </View>
        </>
      ) : (
        <KPIDashboard averias={averias} />
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
