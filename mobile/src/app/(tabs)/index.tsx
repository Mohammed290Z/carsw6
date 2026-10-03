import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarCard } from '@/components/CarCard';
import { Chip, Notice, Row, Txt } from '@/components/ui';
import { Tag, useFleet } from '@/lib/fleet';
import { useI18n } from '@/lib/i18n';
import { color, font, radius, space } from '@/lib/theme';

const FILTERS: ('all' | Tag)[] = ['all', 'lux', 'suv', 'city'];

export default function Explore() {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useI18n();
  const { fleet, offline, refreshing, refresh } = useFleet();
  const [filter, setFilter] = useState<'all' | Tag>('all');
  const [q, setQ] = useState('');
  const cars = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return fleet.cars.filter(c => (filter === 'all' || c.tags.includes(filter)) && (!needle || c.name.toLowerCase().includes(needle)));
  }, [fleet, filter, q]);

  const header = (
    <View style={{ gap: space.m, paddingTop: insets.top + space.m, paddingBottom: space.m }}>
      <Txt v="eyebrow">CARSW6</Txt>
      <Txt v="display">{t('explore.title')}</Txt>
      <Txt style={{ color: color.textDim }}>{t('explore.lede')}</Txt>
      {offline && <Notice text={t('offline')} />}
      <Row style={styles.search}>
        <Ionicons name="search" size={18} color={color.textDim} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('search')} placeholderTextColor={color.textFaint}
          accessibilityLabel={t('search')} autoCorrect={false} clearButtonMode="while-editing"
          style={[styles.searchInput, { textAlign: rtl ? 'right' : 'left', fontFamily: rtl ? font.arSans : font.sans }]} />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map(f => (
          <Chip key={f} label={t(`filter.${f}`)} active={filter === f} onPress={() => setFilter(f)}
            count={f === 'all' ? fleet.cars.length : fleet.cars.filter(c => c.tags.includes(f)).length} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      data={cars}
      keyExtractor={c => c.id}
      renderItem={({ item }) => <CarCard car={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<Txt center style={{ color: color.textDim, marginTop: space.xl }}>{t('noResults')}</Txt>}
      ItemSeparatorComponent={() => <View style={{ height: space.m }} />}
      contentContainerStyle={{ paddingHorizontal: space.m, paddingBottom: space.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.accent} />}
      keyboardDismissMode="on-drag"
      initialNumToRender={5}
    />
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderColor: color.line, borderRadius: radius.pill, paddingHorizontal: space.m, minHeight: 48 },
  searchInput: { flex: 1, color: color.text, fontSize: 16, minHeight: 48 },
});
