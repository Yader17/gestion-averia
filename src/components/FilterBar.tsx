import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

type SolucionadoFilter = 'todos' | 'si' | 'no';

type FilterBarProps = {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  solucionadoFilter: SolucionadoFilter;
  onSolucionadoFilterChange: (filter: SolucionadoFilter) => void;
  resultCount: number;
  totalCount: number;
};

export function FilterBar({
  searchText,
  onSearchTextChange,
  solucionadoFilter,
  onSolucionadoFilterChange,
  resultCount,
  totalCount,
}: FilterBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={onSearchTextChange}
          placeholder="Buscar por bastidor, observación, lugar, intervención..."
          placeholderTextColor={COLORS.textSecondary}
        />
        {searchText.length > 0 && (
          <Pressable
            style={styles.clearButton}
            onPress={() => onSearchTextChange('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Solucionado:</Text>
        {(['todos', 'si', 'no'] as SolucionadoFilter[]).map((opt) => (
          <Pressable
            key={opt}
            style={[
              styles.filterChip,
              solucionadoFilter === opt && styles.filterChipActive,
            ]}
            onPress={() => onSolucionadoFilterChange(opt)}
          >
            <Text
              style={[
                styles.filterChipText,
                solucionadoFilter === opt && styles.filterChipTextActive,
              ]}
            >
              {opt === 'todos' ? 'Todos' : opt.toUpperCase()}
            </Text>
          </Pressable>
        ))}

        {(searchText.length > 0 || solucionadoFilter !== 'todos') && (
          <Text style={styles.resultCount}>
            {resultCount} de {totalCount}
          </Text>
        )}
      </View>
    </View>
  );
}

export type { SolucionadoFilter };

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  clearButton: {
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.border,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  resultCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: 'auto',
  },
});
