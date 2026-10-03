// A bottom sheet with a list of choices (times, delivery places).
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { color, HIT, radius, space } from '@/lib/theme';
import { Dir, Row, Txt } from './ui';

export function PickerSheet<T extends string>({ visible, title, options, value, onPick, onClose }: {
  visible: boolean; title: string; options: { id: T; label: string; sub?: string }[]; value: T;
  onPick: (v: T) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.m }]}>
        <Dir style={{ flex: 0 }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.m, paddingVertical: space.s }}>
            <Txt v="h3">{title}</Txt>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={styles.close}>
              <Ionicons name="close" size={22} color={color.text} />
            </Pressable>
          </Row>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map(o => (
              <Pressable key={o.id} onPress={() => { onPick(o.id); onClose(); }} accessibilityRole="button" accessibilityState={{ selected: o.id === value }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: color.surface }]}>
                <View style={{ flex: 1 }}>
                  <Txt v="label" style={{ color: o.id === value ? color.accent : color.text }}>{o.label}</Txt>
                  {o.sub && <Txt v="small" style={{ color: color.textDim }}>{o.sub}</Txt>}
                </View>
                {o.id === value && <Ionicons name="checkmark" size={20} color={color.accent} />}
              </Pressable>
            ))}
          </ScrollView>
        </Dir>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.overlay },
  sheet: { backgroundColor: color.bg, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, borderTopWidth: 1, borderColor: color.line },
  close: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.m, borderTopWidth: StyleSheet.hairlineWidth, borderColor: color.line },
});
