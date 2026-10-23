import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  Averia,
  AveriaFormData,
  AveriaLocation,
  AveriaPhoto,
  AveriaType,
  AVERIA_TYPES,
  getAveriaPhotos,
  INTERVENCION_TYPES,
} from '../types/averia';
import { FONT_SIZES, SPACING } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { formatDate, getTodayFormatted, parseDate } from '../utils/dateUtils';
import { generateId } from '../utils/idGenerator';
import { GeocodingResult, searchRealLocations } from '../services/geocodingService';

type AveriaFormModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: AveriaFormData) => Promise<void> | void;
  initialData?: Averia | null;
  customIntervencionTypes?: string[];
  onAddCustomIntervencion?: (type: string) => void;
  onDeleteCustomIntervencion?: (type: string) => void;
};

const EMPTY_FORM: AveriaFormData = {
  fecha: getTodayFormatted(),
  numeroBastidor: '',
  tipoAveria: 'Otro',
  intervencion: '',
  lugar: '',
  ubicacion: null,
  observacion: '',
  solucionado: false,
  fotos: [],
};

export function AveriaFormModal({
  visible,
  onClose,
  onSubmit,
  initialData,
  customIntervencionTypes = [],
  onAddCustomIntervencion,
  onDeleteCustomIntervencion,
}: AveriaFormModalProps) {
  const { colors: COLORS } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [formData, setFormData] = useState<AveriaFormData>({
    ...EMPTY_FORM,
    fecha: getTodayFormatted(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showIntervencionPicker, setShowIntervencionPicker] = useState(false);
  const [customIntervencionName, setCustomIntervencionName] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allIntervencionTypes = [
    ...INTERVENCION_TYPES.filter((type) => type !== 'Otro'),
    ...customIntervencionTypes,
    'Otro',
  ];

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (initialData) {
      setFormData({
        fecha: initialData.fecha,
        numeroBastidor: initialData.numeroBastidor,
        tipoAveria: initialData.tipoAveria,
        intervencion: initialData.intervencion,
        lugar: initialData.lugar,
        ubicacion: initialData.ubicacion ?? null,
        observacion: initialData.observacion,
        solucionado: initialData.solucionado,
        fotos: getAveriaPhotos(initialData),
      });
      setLocationQuery(initialData.lugar);
      setLocationResults([]);
      return;
    }

    resetForm();
  }, [initialData, visible]);

  const currentDateValue = parseDate(formData.fecha) ?? new Date();
  const isEditing = initialData !== null && initialData !== undefined;

  const updateField = <K extends keyof AveriaFormData>(
    key: K,
    value: AveriaFormData[K]
  ) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowDatePicker(false);

    if (event.type === 'set' && selectedDate) {
      updateField('fecha', formatDate(selectedDate));
    }
  };

  const handleSubmit = async () => {
    if (!formData.fecha.trim()) {
      showFormAlert('Validación', 'La fecha es obligatoria.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        ...formData,
        lugar: locationQuery.trim() || formData.lugar,
      });
      resetForm();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      showFormAlert('No se pudo guardar', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    resetForm();
    onClose();
  };

  const handlePickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showFormAlert(
        'Permiso requerido',
        'Debes permitir el acceso a tus fotos para adjuntarlas a la avería.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    appendPhotos(result.assets.map(mapAssetToPhoto));
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      showFormAlert(
        'Permiso requerido',
        'Debes permitir el uso de la cámara para tomar fotos de la avería.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    appendPhotos(result.assets.map(mapAssetToPhoto));
  };

  const handleRemovePhoto = (photoId: string) => {
    setFormData((previous) => ({
      ...previous,
      fotos: previous.fotos.filter((photo) => photo.id !== photoId),
    }));
  };

  const appendPhotos = (photos: AveriaPhoto[]) => {
    setFormData((previous) => ({
      ...previous,
      fotos: [...previous.fotos, ...photos],
    }));
  };

  const handleSearchLocation = async () => {
    const query = locationQuery.trim();
    if (query.length < 3) {
      showFormAlert('Ubicación', 'Escribe al menos 3 caracteres para buscar.');
      return;
    }

    try {
      setIsSearchingLocation(true);
      const results = await searchRealLocations(query);
      setLocationResults(results);

      if (results.length === 0) {
        showFormAlert('Sin resultados', 'No se encontraron ubicaciones con ese texto.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido al buscar ubicación.';
      showFormAlert('Error de ubicación', message);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handlePickLocation = (location: AveriaLocation) => {
    setLocationQuery(location.displayName);
    setFormData((previous) => ({
      ...previous,
      lugar: location.displayName,
      ubicacion: location,
    }));
    setLocationResults([]);
  };

  const handleLugarTextChange = (text: string) => {
    setLocationQuery(text);
    setLocationResults([]);
    setFormData((previous) => {
      const keepLocation = previous.ubicacion?.displayName === text;

      return {
        ...previous,
        lugar: text,
        ubicacion: keepLocation ? previous.ubicacion : null,
      };
    });
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM, fecha: getTodayFormatted() });
    setLocationQuery('');
    setShowDatePicker(false);
    setShowTypePicker(false);
    setShowIntervencionPicker(false);
    setCustomIntervencionName('');
    setLocationResults([]);
    setIsSearchingLocation(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.title}>
                {isEditing ? 'Editar Avería' : 'Nueva Avería'}
              </Text>

              <Text style={styles.label}>Fecha</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  style={styles.input}
                  value={formData.fecha}
                  onChangeText={(text) => updateField('fecha', text)}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={COLORS.textSecondary}
                />
              ) : (
                <>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.pickerButtonText}>{formData.fecha}</Text>
                    <Text style={styles.pickerArrow}>📅</Text>
                  </Pressable>
                  {showDatePicker && (
                    <DateTimePicker
                      value={currentDateValue}
                      mode="date"
                      display="default"
                      onChange={handleDateChange}
                    />
                  )}
                </>
              )}

              <Text style={styles.label}>Nº Bastidor</Text>
              <TextInput
                style={styles.input}
                value={formData.numeroBastidor}
                onChangeText={(text) => updateField('numeroBastidor', text)}
                placeholder="Número de bastidor"
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={styles.label}>Tipo de Avería</Text>
              <Pressable
                style={styles.pickerButton}
                onPress={() => setShowTypePicker((previous) => !previous)}
              >
                <Text style={styles.pickerButtonText}>{formData.tipoAveria}</Text>
                <Text style={styles.pickerArrow}>{showTypePicker ? '▲' : '▼'}</Text>
              </Pressable>

              {showTypePicker && (
                <View style={styles.pickerDropdown}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                    {AVERIA_TYPES.map((type) => (
                      <Pressable
                        key={type}
                        style={[
                          styles.pickerOption,
                          formData.tipoAveria === type && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          updateField('tipoAveria', type as AveriaType);
                          setShowTypePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            formData.tipoAveria === type &&
                              styles.pickerOptionTextSelected,
                          ]}
                        >
                          {type}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.label}>Intervención</Text>
              <Pressable
                style={styles.pickerButton}
                onPress={() =>
                  setShowIntervencionPicker((previous) => !previous)
                }
              >
                <Text style={styles.pickerButtonText}>
                  {formData.intervencion || 'Seleccionar...'}
                </Text>
                <Text style={styles.pickerArrow}>
                  {showIntervencionPicker ? '▲' : '▼'}
                </Text>
              </Pressable>

              {showIntervencionPicker && (
                <View style={styles.pickerDropdown}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                    {allIntervencionTypes.map((type) => {
                      const isCustom = customIntervencionTypes.includes(type);

                      return (
                        <View
                          key={type}
                          style={[
                            styles.pickerOption,
                            formData.intervencion === type &&
                              styles.pickerOptionSelected,
                            styles.pickerOptionRow,
                          ]}
                        >
                          <Pressable
                            style={styles.pickerOptionContent}
                            onPress={() => {
                              if (type === 'Otro') {
                                updateField('intervencion', '');
                                setCustomIntervencionName('');
                              } else {
                                updateField('intervencion', type);
                              }

                              setShowIntervencionPicker(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                formData.intervencion === type &&
                                  styles.pickerOptionTextSelected,
                              ]}
                            >
                              {type === 'Otro' ? '+ Agregar nuevo...' : type}
                            </Text>
                          </Pressable>

                          {isCustom && onDeleteCustomIntervencion && (
                            <Pressable
                              style={styles.deleteCustomButton}
                              onPress={() => {
                                onDeleteCustomIntervencion(type);
                                if (formData.intervencion === type) {
                                  updateField('intervencion', '');
                                }
                              }}
                            >
                              <Text style={styles.deleteCustomText}>✕</Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {formData.intervencion === '' && !showIntervencionPicker && (
                <View style={styles.customTypeRow}>
                  <TextInput
                    style={[styles.input, styles.flexInput]}
                    value={customIntervencionName}
                    onChangeText={setCustomIntervencionName}
                    placeholder="Nombre de la empresa..."
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  <Pressable
                    style={[
                      styles.addCustomButton,
                      !customIntervencionName.trim() && styles.disabledButton,
                    ]}
                    onPress={() => {
                      const name = customIntervencionName.trim();
                      if (name && onAddCustomIntervencion) {
                        onAddCustomIntervencion(name);
                        updateField('intervencion', name);
                        setCustomIntervencionName('');
                      }
                    }}
                    disabled={!customIntervencionName.trim()}
                  >
                    <Text style={styles.addCustomButtonText}>Guardar</Text>
                  </Pressable>
                </View>
              )}

              <Text style={styles.label}>Lugar</Text>
              <View style={styles.locationSearchRow}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={locationQuery}
                  onChangeText={handleLugarTextChange}
                  placeholder="Buscar dirección real o punto en mapa"
                  placeholderTextColor={COLORS.textSecondary}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    void handleSearchLocation();
                  }}
                />
                <Pressable
                  style={styles.locationSearchButton}
                  onPress={() => {
                    void handleSearchLocation();
                  }}
                  disabled={isSearchingLocation}
                >
                  <Text style={styles.locationSearchText}>
                    {isSearchingLocation ? 'Buscando...' : 'Buscar'}
                  </Text>
                </Pressable>
              </View>

              {formData.ubicacion ? (
                <View style={styles.locationSelectedBadge}>
                  <Text style={styles.locationSelectedText}>
                    Ubicación real confirmada
                  </Text>
                </View>
              ) : (
                <Text style={styles.locationHint}>
                  Puedes guardar solo el texto o buscar una ubicación real para guardar coordenadas.
                </Text>
              )}

              {locationResults.length > 0 && (
                <View style={styles.locationResultsContainer}>
                  {locationResults.map((result) => (
                    <Pressable
                      key={`${result.latitude}-${result.longitude}-${result.displayName}`}
                      style={styles.locationResultItem}
                      onPress={() => handlePickLocation(result)}
                    >
                      <Text style={styles.locationResultText}>{result.displayName}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Observación</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.observacion}
                onChangeText={(text) => updateField('observacion', text)}
                placeholder="Descripción detallada de la avería..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <Text style={styles.label}>Fotos</Text>
              <View style={styles.photoButtonsRow}>
                <Pressable
                  style={styles.photoActionButton}
                  onPress={handleTakePhoto}
                >
                  <Text style={styles.photoActionText}>📷 Cámara</Text>
                </Pressable>
                <Pressable
                  style={styles.photoActionButton}
                  onPress={handlePickFromLibrary}
                >
                  <Text style={styles.photoActionText}>🖼️ Galería</Text>
                </Pressable>
              </View>

              {formData.fotos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.photoList}
                >
                  {formData.fotos.map((photo) => (
                    <View key={photo.id} style={styles.photoCard}>
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                      <Pressable
                        style={styles.removePhotoButton}
                        onPress={() => handleRemovePhoto(photo.id)}
                      >
                        <Text style={styles.removePhotoText}>✕</Text>
                      </Pressable>
                      <Text style={styles.photoName} numberOfLines={1}>
                        {photo.fileName}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.photoHint}>
                  Añade fotos para que aparezcan como anexo en el reporte PDF.
                </Text>
              )}

              <Text style={styles.label}>Solucionado</Text>
              <View style={styles.toggleContainer}>
                <Pressable
                  style={[
                    styles.toggleOption,
                    !formData.solucionado && styles.toggleOptionActiveNo,
                  ]}
                  onPress={() => updateField('solucionado', false)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      !formData.solucionado && styles.toggleTextActive,
                    ]}
                  >
                    NO
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.toggleOption,
                    formData.solucionado && styles.toggleOptionActiveSi,
                  ]}
                  onPress={() => updateField('solucionado', true)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      formData.solucionado && styles.toggleTextActive,
                    ]}
                  >
                    SI
                  </Text>
                </Pressable>
              </View>

              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={handleClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.submitButton,
                    isSubmitting && styles.disabledButton,
                  ]}
                  onPress={() => {
                    void handleSubmit();
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitButtonText}>
                    {isSubmitting
                      ? 'Guardando...'
                      : isEditing
                        ? 'Guardar'
                        : 'Agregar'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function mapAssetToPhoto(asset: ImagePicker.ImagePickerAsset): AveriaPhoto {
  const photoId = generateId();
  const extension =
    asset.fileName?.split('.').pop()?.toLowerCase() ??
    asset.mimeType?.split('/').pop()?.toLowerCase() ??
    'jpg';

  return {
    id: photoId,
    uri: asset.uri,
    fileName: asset.fileName ?? `foto-${photoId}.${extension}`,
    mimeType: asset.mimeType ?? `image/${extension}`,
    width: asset.width,
    height: asset.height,
  };
}

function showFormAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

const createStyles = (COLORS: Palette) => StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
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
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  flexInput: {
    flex: 1,
  },
  textArea: {
    minHeight: 120,
    paddingTop: SPACING.sm,
    textAlignVertical: 'top',
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  pickerArrow: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  pickerDropdown: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    marginTop: SPACING.xs,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  pickerOption: {
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  pickerOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerOptionContent: {
    flex: 1,
  },
  pickerOptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  pickerOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  customTypeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    alignItems: 'center',
  },
  locationSearchRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  locationSearchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  locationSearchText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  locationHint: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  locationSelectedBadge: {
    marginTop: SPACING.xs,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.solucionadoSi,
    borderRadius: 16,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  locationSelectedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: '700',
  },
  locationResultsContainer: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  locationResultItem: {
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  locationResultText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  addCustomButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  addCustomButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  deleteCustomButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.solucionadoNo,
  },
  deleteCustomText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  photoActionButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  photoActionText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  photoList: {
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  photoCard: {
    width: 128,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    backgroundColor: COLORS.border,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  photoName: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  photoHint: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  toggleOptionActiveSi: {
    backgroundColor: COLORS.solucionadoSi,
    borderColor: COLORS.success,
  },
  toggleOptionActiveNo: {
    backgroundColor: COLORS.solucionadoNo,
    borderColor: COLORS.error,
  },
  toggleText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: COLORS.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  disabledButton: {
    opacity: 0.55,
  },
});