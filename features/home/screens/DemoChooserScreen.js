import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/ui/Card';
import Wordmark from '../../../components/ui/Wordmark';
import FadeInView from '../../../components/ui/FadeInView';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { COLORS, SPACING, TYPE, SIZES, BORDER } from '../../../theme';
import IconCircle from '../../../components/ui/IconCircle';

// the two ways into the demo, both run on the same local sample data and never touch an account
const demo_choices = [
  {
    role: 'owner',
    title: 'Demo as Landlord',
    detail: 'Work orders, tenants, expenses, documents, and checklists for the sample properties.',
    icon: 'business-outline',
    color: COLORS.success,
    tone: 'brand',
    hint: 'Starts the demo on the landlord dashboard',
  },
  {
    role: 'tenant',
    title: 'Demo as Tenant',
    detail: 'Sam Rivera at 123 Maple St, Unit 2: message the landlord and report an issue.',
    icon: 'key-outline',
    color: COLORS.accent,
    tone: 'brand',
    hint: "Starts the demo on Sam's home screen",
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
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.lg }]}
    >
      {/* the same lockup as Welcome and the sign in screens, with the demo's note under it */}
      <FadeInView index={0} style={styles.top}>
        <Wordmark size="medium" tagline={null} />
        <Text style={styles.intro}>
          Try Rent Well with sample data. Nothing is saved, and you can switch sides any time from
          the demo banner.
        </Text>
      </FadeInView>
      {demo_choices.map((choice, index) => (
        <FadeInView key={choice.role} index={index + 1}>
          <Card
            variant="interactive"
            onPress={() => startDemo(choice.role)}
            accessibilityLabel={choice.title}
            accessibilityHint={choice.hint}
            style={[styles.choice_card, index === demo_choices.length - 1 && styles.choice_last]}
          >
            <View style={styles.choice_row}>
              {/* the fintech pass: a soft tinted circle instead of a solid one */}
              {/* the Hearth pass: just the green line icon, the circle is gone */}
              <IconCircle
                icon={choice.icon}
                tone={choice.tone}
                size={SIZES.row_icon + SPACING.sm}
              />
              <View style={styles.choice_text}>
                <Text style={styles.choice_title}>{choice.title}</Text>
                <Text style={styles.choice_detail}>{choice.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={SIZES.chevron} color={COLORS.text_muted} />
            </View>
          </Card>
        </FadeInView>
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
  content: {
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    paddingHorizontal: SIZES.screen_padding,
    paddingTop: SPACING.lg,
  },
  top: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  intro: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  // each choice is a ruled row on the paper, the last one gets a line under it too
  choice_card: {
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
    paddingVertical: SPACING.md,
    minHeight: SIZES.row_min_height,
  },
  choice_last: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.hairline,
  },
  choice_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  choice_text: {
    flex: 1,
  },
  choice_title: {
    ...TYPE.subheading,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  choice_detail: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
});
