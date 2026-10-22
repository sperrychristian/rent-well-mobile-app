import { Modal, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetHandle, sheet_styles } from './sheet';
import Button from './Button';
import { useReduceMotion } from './useReduceMotion';
import { lineIcon } from './lineIcon';
import { COLORS, SPACING, TYPE, BORDER, SIZES } from '../../theme';
import { themedStyles } from '../../utils/themedStyles';

// a short list of choices that slides up from the bottom (the ledger's "More"), the Hearth sheet look:
// white with 12 corners and the one shadow, each choice a ruled row with a line icon, Cancel at the bottom
// props: visible, title, actions ([{ label, icon, onPress, destructive }]), onClose
function ActionSheet(props) {
  const reduce_motion = useReduceMotion();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType={reduce_motion ? 'none' : 'slide'}
      onRequestClose={props.onClose}
    >
      <View style={sheet_styles.backdrop}>
        {/* tapping the dim part closes it, like Cancel */}
        <Pressable
          style={styles.dismiss}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[sheet_styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <SheetHandle />
          {props.title ? (
            <Text style={styles.title} accessibilityRole="header">
              {props.title}
            </Text>
          ) : null}
          {props.actions.map((action, index) => {
            const color = action.destructive ? COLORS.danger_text : COLORS.text;
            return (
              <Pressable
                key={action.label}
                onPress={() => {
                  props.onClose();
                  action.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.row,
                  index === props.actions.length - 1 && styles.last,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={lineIcon(action.icon)}
                  size={SIZES.row_icon}
                  color={action.destructive ? COLORS.danger_text : COLORS.cta}
                />
                <Text style={[styles.label, { color: color }]}>{action.label}</Text>
              </Pressable>
            );
          })}
          <Button
            variant="secondary"
            title="Cancel"
            onPress={props.onClose}
            style={styles.cancel}
          />
        </View>
      </View>
    </Modal>
  );
}

export default ActionSheet;

const styles = themedStyles((COLORS) => ({
  dismiss: {
    flex: 1,
  },
  title: {
    ...TYPE.overline,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: SIZES.row_min_height,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  last: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.hairline,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
  label: {
    ...TYPE.subheading,
    flexShrink: 1,
  },
  cancel: {
    marginHorizontal: 0,
    marginTop: SPACING.md,
  },
}));
