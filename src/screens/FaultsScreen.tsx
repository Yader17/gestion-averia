import React from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Averia } from '../types/averia';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import { AveriaCard } from '../components/AveriaCard';
import { AveriaTable } from '../components/AveriaTable';
import { DateSortOrder, FilterBar, SolucionadoFilter } from '../components/FilterBar';
import { DESKTOP_BREAKPOINT } from '../navigation/BottomNavBar';

type Props = {
  averias: Averia[];
  totalCount: number;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  solucionadoFilter: SolucionadoFilter;
  onSolucionadoFilterChange: (filter: SolucionadoFilter) => void;
  dateSortOrder: DateSortOrder;
  onDateSortOrderChange: (order: DateSortOrder) => void;
  onEditAveria: (averia: Averia) => void;
  onDeleteAveria: (id: string) => void;
  onGenerateReport: (averia: Averia) => void;
};

export function FaultsScreen(props: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const useTable = width >= DESKTOP_BREAKPOINT;

  return (
    <View style={styles.container}>
      <FilterBar
        searchText={props.searchText}
        onSearchTextChange={props.onSearchTextChange}
        solucionadoFilter={props.solucionadoFilter}
        onSolucionadoFilterChange={props.onSolucionadoFilterChange}
        dateSortOrder={props.dateSortOrder}
        onDateSortOrderChange={props.onDateSortOrderChange}
        resultCount={props.averias.length}
        totalCount={props.totalCount}
      />
      {useTable ? (
        <View style={styles.tableContainer}>
          <AveriaTable
            averias={props.averias}
            onEditAveria={props.onEditAveria}
            onDeleteAveria={props.onDeleteAveria}
            onGenerateReport={props.onGenerateReport}
          />
        </View>
      ) : (
        <FlatList
          data={props.averias}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          initialNumToRender={10}
          windowSize={7}
          ListEmptyComponent={<Text style={styles.empty}>{t('faults_empty')}</Text>}
          renderItem={({ item }) => (
            <AveriaCard
              averia={item}
              onPress={props.onEditAveria}
              onReport={props.onGenerateReport}
              onDelete={props.onDeleteAveria}
            />
          )}
        />
      )}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1 },
    tableContainer: { flex: 1, padding: SPACING.md },
    list: { padding: SPACING.md, paddingBottom: 96 },
    empty: { textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZES.md, marginTop: SPACING.xl },
  });
