import { StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';
import PrimaryButton from '../../../components/PrimaryButton';
import Wordmark from '../../../components/ui/Wordmark';
import FadeInView from '../../../components/ui/FadeInView';
import PixelGridBackground from '../../../components/ui/PixelGridBackground';
import { useWorkOrders } from '../../../context/WorkOrdersContext';

// the design pass: a hero with the pixel house and the wordmark over a faint pixel grid,
// and the buttons down in the thumb zone (Log In, then Sign Up, then the demo with a line explaining it)
// on a wide landscape screen the hero and the buttons sit side by side, and on an iPad it's capped to a phone width
function WelcomeScreen(props) {
  const { exitDemo } = useWorkOrders();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const side_by_side = width > height && width >= 700;

  return (
    <View style={styles.screen}>
      <PixelGridBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          side_by_side && styles.content_wide,
          {
            paddingBottom: insets.bottom + SPACING.lg,
            paddingLeft: insets.left + SPACING.lg,
            paddingRight: insets.right + SPACING.lg,
          },
        ]}
      >
        <FadeInView index={0} style={[styles.hero, side_by_side && styles.half]}>
          <Wordmark size={height < 600 ? 'medium' : 'large'} />
        </FadeInView>

        <View style={[styles.actions, side_by_side && styles.half]}>
          <FadeInView index={1}>
            {/* login always starts in real mode, so I leave the demo first if someone swiped back out of it */}
            <PrimaryButton
              title="Log In"
              icon="log-in-outline"
              variant="primary"
              size="large"
              style={styles.full_button}
              onPress={async () => {
                await exitDemo();
                props.navigation.navigate('Login');
              }}
            />
          </FadeInView>
          <FadeInView index={2}>
            {/* sign up goes to the landlord form, it links over to the tenant invite form */}
            <PrimaryButton
              title="Sign Up"
              icon="person-add-outline"
              variant="secondary"
              size="large"
              style={styles.full_button}
              onPress={async () => {
                await exitDemo();
                props.navigation.navigate('RegisterOwner');
              }}
            />
          </FadeInView>
          <FadeInView index={3} style={styles.demo_group}>
            {/* the demo needs no account, it starts on fresh sample data and never saves */}
            {/* the chooser picks landlord or tenant first, and starting the demo there opens that side's home */}
            <PrimaryButton
              title="Try the Demo"
              icon="play-circle-outline"
              variant="tertiary"
              accessibilityHint="Explore as a landlord or tenant, no account needed"
              style={styles.demo_button}
              onPress={() => props.navigation.navigate('DemoChooser')}
            />
            <Text style={styles.demo_note}>Explore as a landlord or tenant, no account needed</Text>
          </FadeInView>
        </View>
      </ScrollView>
    </View>
  );
}

export default WelcomeScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // flexGrow with space-between puts the hero up top and the buttons at the bottom, and still scrolls on a small phone
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    paddingTop: SPACING.lg,
  },
  content_wide: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: SIZES.content_max_width * 2,
    gap: SPACING.xl,
  },
  half: {
    flex: 1,
  },
  hero: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  actions: {
    gap: SPACING.sm + SPACING.xs,
    paddingTop: SPACING.lg,
  },
  full_button: {
    marginHorizontal: 0,
  },
  demo_group: {
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  demo_button: {
    marginHorizontal: 0,
    alignSelf: 'stretch',
  },
  demo_note: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    textAlign: 'center',
  },
});
