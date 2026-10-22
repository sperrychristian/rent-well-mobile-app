import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetHandle, sheet_styles } from '../../../components/ui/sheet';
import Button from '../../../components/ui/Button';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';
import { COLORS, SPACING, TYPE, BORDER, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// four short things to try, one list for each side of the demo, all on the shared sample data
export const tour_points = {
  owner: [
    {
      icon: 'card-outline',
      text: "Open Payments and confirm Jordan's $75 claim, the balance updates right away.",
    },
    {
      icon: 'reader-outline',
      text: 'Tap Sam on Payments to see the Rent Ledger, then Record Payment.',
    },
    {
      icon: 'construct-outline',
      text: 'Open Work Orders and start or resolve a repair.',
    },
    {
      icon: 'swap-horizontal-outline',
      text: "Tap Switch view in the green strip to see Sam's side of the same data.",
    },
  ],
  tenant: [
    {
      icon: 'card-outline',
      text: "Open Payments to see what's due, then tap I Paid to tell your landlord.",
    },
    {
      icon: 'construct-outline',
      text: 'Report an Issue with a photo, it shows up for the landlord right away.',
    },
    {
      icon: 'chatbubble-outline',
      text: 'Message your landlord, a reply comes back in a few seconds.',
    },
    {
      icon: 'swap-horizontal-outline',
      text: 'Tap Switch view to confirm your own claim as the landlord.',
    },
  ],
};

// a one-time sheet the first time someone enters the demo, and again from Settings
// it says nothing is saved and Exit Demo Mode resets it all
// props: visible, role (owner or tenant), onClose
function DemoTourSheet(props) {
  const reduce_motion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const points = tour_points[props.role === 'tenant' ? 'tenant' : 'owner'];
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType={reduce_motion ? 'none' : 'slide'}
      onRequestClose={props.onClose}
    >
      <View style={sheet_styles.backdrop}>
        <Pressable
          style={styles.dismiss}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel="Close the tour"
        />
        <View style={[sheet_styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <SheetHandle />
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title} accessibilityRole="header">
              {props.role === 'tenant' ? 'Try the tenant side' : 'Try the landlord side'}
            </Text>
            <Text style={styles.intro}>
              Everything here is sample data. Nothing is saved, and Exit Demo Mode resets it all.
            </Text>
            {points.map((point, index) => (
              <View
                key={point.text}
                style={[styles.row, index === points.length - 1 && styles.last]}
                accessible
                accessibilityLabel={index + 1 + '. ' + point.text}
              >
                <Ionicons name={point.icon} size={SIZES.row_icon} color={COLORS.cta} />
                <Text style={styles.point}>{point.text}</Text>
              </View>
            ))}
            <Button
              variant="primary"
              title="Got It"
              onPress={props.onClose}
              style={styles.button}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default DemoTourSheet;

const styles = themedStyles((COLORS) => ({
  dismiss: {
    flex: 1,
  },
  content: {
    paddingBottom: SPACING.sm,
  },
  title: {
    ...TYPE.empty_title,
    color: COLORS.text,
  },
  intro: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: SIZES.row_min_height,
    paddingVertical: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  last: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.hairline,
  },
  point: {
    ...TYPE.body,
    color: COLORS.text,
    flex: 1,
  },
  button: {
    marginHorizontal: 0,
    marginTop: SPACING.lg,
  },
}));
