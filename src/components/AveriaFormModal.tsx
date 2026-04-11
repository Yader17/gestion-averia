import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Averia, AveriaFormData, AveriaType, AVERIA_TYPES, INTERVENCION_TYPES } from '../types/averia';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { getTodayFormatted, parseDate, formatDate } from '../utils/dateUtils';

type AveriaFormModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: AveriaFormData) => void;
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
  observacion: '',
  solucionado: false,
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
  const [formData, setFormData] = useState<AveriaFormData>(
    { ...EMPTY_FORM, fecha: getTodayFormatted() }
  );

  const allIntervencionTypes = [
    ...INTERVENCION_TYPES.filter((t) => t !== 'Otro'),
    ...customIntervencionTypes,
    'Otro',
  ];

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setFormData({
          fecha: initialData.fecha,
          numeroBastidor: initialData.numeroBastidor,
          tipoAveria: initialData.tipoAveria,
          intervencion: initialData.intervencion,
          lugar: initialData.lugar,
          observacion: initialData.observacion,
          solucionado: initialData.solucionado,
        });
      } else {
        setFormData({ ...EMPTY_FORM, fecha: getTodayFormatted() });
      }
    }
  }, [visible, initialData]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showIntervencionPicker, setShowIntervencionPicker] = useState(false);
  const [customIntervencionName, setCustomIntervencionName] = useState('');

  const currentDateValue = parseDate(formData.fecha) ?? new Date();

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      updateField('fecha', formatDate(selectedDate));
    }
  };

  const updateField = <K extends keyof AveriaFormData>(
    key: K,
    value: AveriaFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!formData.fecha.trim()) {
      return;
    }
    onSubmit(formData);
    setFormData({ ...EMPTY_FORM, fecha: getTodayFormatted() });
    onClose();
  };

  const handleClose = () => {
    setFormData({ ...EMPTY_FORM, fecha: getTodayFormatted() });
    onClose();
  };

  const isEditing = initialData !== null && initialData !== undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={styles.title}>
              {isEditing ? 'Editar Avería' : 'Nueva Avería'}
            </Text>

            {/* Fecha */}
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

            {/* Nº Bastidor */}
            <Text style={styles.label}>Nº Bastidor</Text>
            <TextInput
              style={styles.input}
              value={formData.numeroBastidor}
              onChangeText={(text) => updateField('numeroBastidor', text)}
              placeholder="Número de bastidor"
              placeholderTextColor={COLORS.textSecondary}
            />

            {/* Tipo de Avería */}
            <Text style={styles.label}>Tipo de Avería</Text>
            <Pressable
              style={styles.pickerButton}
              onPress={() => setShowTypePicker(!showTypePicker)}
            >
              <Text style={styles.pickerButtonText}>{formData.tipoAveria}</Text>
              <Text style={styles.pickerArrow}>
                {showTypePicker ? '▲' : '▼'}
              </Text>
            </Pressable>

            {showTypePicker && (
              <View style={styles.pickerDropdown}>
                <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
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

            {/* Intervención */}
            <Text style={styles.label}>Intervención</Text>
            <Pressable
              style={styles.pickerButton}
              onPress={() => setShowIntervencionPicker(!showIntervencionPicker)}
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
                <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
                  {allIntervencionTypes.map((type) => {
                    const isCustom = customIntervencionTypes.includes(type);
                    return (
                      <View key={type} style={[styles.pickerOption, formData.intervencion === type && styles.pickerOptionSelected, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                        <Pressable
                          style={{ flex: 1 }}
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
                  style={[styles.input, { flex: 1 }]}
                  value={customIntervencionName}
                  onChangeText={setCustomIntervencionName}
                  placeholder="Nombre de la empresa..."
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Pressable
                  style={[
                    styles.addCustomButton,
                    !customIntervencionName.trim() && { opacity: 0.5 },
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

            {/* Lugar */}
            <Text style={styles.label}>Lugar</Text>
            <TextInput
              style={styles.input}
              value={formData.lugar}
              onChangeText={(text) => updateField('lugar', text)}
              placeholder="Ubicación"
              placeholderTextColor={COLORS.textSecondary}
            />

            {/* Observación */}
            <Text style={styles.label}>Observación</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.observacion}
              onChangeText={(text) => updateField('observacion', text)}
              placeholder="Descripción detallada de la avería..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Solucionado */}
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

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <Pressable style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>
                  {isEditing ? 'Guardar' : 'Agregar'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
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
    maxWidth: 500,
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
  textArea: {
    minHeight: 100,
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
  pickerOption: {
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  pickerOptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  pickerOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
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
  customTypeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    alignItems: 'center',
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
});
