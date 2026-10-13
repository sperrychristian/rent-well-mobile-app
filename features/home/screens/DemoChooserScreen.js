import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// the two ways into the demo, both run on the same local sample data and never touch an account
const demo_choices = [
  {
    role: 'owner',
    title: 'Demo as Landlord',
    detail: 'Work orders, tenants, expenses, documents, and checklists for the sample properties.',
    icon: 'business-outline',
    color: COLORS.success,
  },
  {
    role: 'tenant',
    title: 'Demo as Tenant',
    detail: 'Sam Rivera at 123 Maple St, Unit 2: message the landlord and report an issue.',
    icon: 'key-outline',
    color: COLORS.accent,
  },
];

// picks which side the demo opens on, back goes to Welcome like any other screen
function DemoChooserScreen() {
  const insets = useSafeAreaInsets();
  const { startDemo } = useWorkOrders();

  // starting the demo is all it takes: App.js rebuilds the screens on the role's home (Dashboard or the tenant home),
  // so this never needs its own navigate and can't get left sitting here
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
    >
      <Card>
        <Text style={styles.intro}>
          Try Rent Well with sample data. Nothing is saved, and you can switch sides any time from
          the demo banner.
        </Text>
      </Card>
      {demo_choices.map((choice) => (
        <Pressable
          key={choice.role}
          onPress={() => startDemo(choice.role)}
          accessibilityRole="button"
          accessibilityLabel={choice.title}
          style={({ pressed }) => [styles.choice_press, pressed && styles.pressed]}
        >
          <Card>
            <View style={styles.choice_row}>
              <View style={[styles.icon_circle, { backgroundColor: choice.color }]}>
                <Ionicons name={choice.icon} size={28} color={COLORS.text_light} />
              </View>
              <View style={styles.choice_text}>
                <Text style={styles.choice_title}>{choice.title}</Text>
                <Text style={styles.choice_detail}>{choice.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default DemoChooserScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  intro: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.small,
    textAlign: 'center',
  },
  choice_press: {
    width: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
  choice_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  icon_circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choice_text: {
    flex: 1,
  },
  choice_title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.xs,
  },
  choice_detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.small,
    opacity: 0.8,
  },
});
