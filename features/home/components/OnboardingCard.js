import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SectionHeader from '../../../components/ui/SectionHeader';
import ProgressLine from '../../../components/ui/ProgressLine';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import ScheduleFormModal from '../../payments/components/ScheduleFormModal';
import { useLedger } from '../../payments/context/LedgerContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import { useAuth } from '../../auth/context/AuthContext';
import { useOnboardingDismissed } from '../hooks/useOnboardingDismissed';
import { hapticSuccess } from '../../../utils/haptics';
import {
  onboardingSteps,
  onboardingProgress,
  rentTarget,
  showsOnboarding,
} from '../utils/onboarding';
import { COLORS, SPACING, TYPE, BORDER, SIZES, OPACITY } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

const step_icons = {
  property: 'home-outline',
  invite: 'person-add-outline',
  rent: 'calendar-outline',
};

// the first-run checklist at the top of a new landlord's Dashboard: add a property, invite a tenant,
// set the rent, with a progress line and a way to hide it for good
// each step opens what already exists: Your Properties, Invite a New Tenant, and the Rent Schedule sheet
// (right here, for the first tenant who has no rent yet)
// it only draws for a signed-in landlord, never the demo, and goes away once every step is done
// props: navigation
function OnboardingCard(props) {
  const { user } = useAuth();
  const tenants_store = useTenants();
  const ledger_store = useLedger();
  const toast = useToast();
  const [dismissed, dismiss] = useOnboardingDismissed(user ? user.id : null);
  const [schedule_open, setScheduleOpen] = useState(false);

  const steps = onboardingSteps({
    properties: tenants_store.properties,
    tenants: tenants_store.tenants,
    invites: tenants_store.invites,
    ledgers: ledger_store.ledgers,
  });
  const ready = tenants_store.status === 'ready' && ledger_store.status === 'ready';
  if (
    !showsOnboarding({
      mode: ledger_store.mode,
      role: ledger_store.role,
      ready: ready,
      dismissed: dismissed,
      steps: steps,
    })
  ) {
    return null;
  }

  const target = rentTarget(ledger_store.ledgers);
  const done_count = steps.filter((step) => step.done).length;

  function openStep(step) {
    if (step.key === 'property') {
      props.navigation.navigate('Properties');
    } else if (step.key === 'invite') {
      props.navigation.navigate('InviteTenant');
    } else {
      setScheduleOpen(true);
    }
  }

  async function saveSchedule(value) {
    await ledger_store.setRentSchedule(target.tenancy_id, value);
    setScheduleOpen(false);
    hapticSuccess();
    toast.show('Rent schedule saved');
  }

  return (
    <View style={styles.box} accessibilityRole="summary">
      <SectionHeader title="Get set up" count={done_count + ' of ' + steps.length} />
      <ProgressLine
        share={onboardingProgress(steps)}
        label={done_count + ' of ' + steps.length + ' setup steps done'}
        style={styles.progress}
      />
      {steps.map((step, index) => {
        const can_open = !step.done && !step.blocked;
        const content = (
          <>
            <Ionicons
              name={step.done ? 'checkmark-circle-outline' : step_icons[step.key]}
              size={SIZES.row_icon}
              color={
                step.done ? COLORS.success_text : step.blocked ? COLORS.text_muted : COLORS.cta
              }
            />
            <View style={styles.words}>
              <Text style={[styles.title, step.done && styles.title_done]}>{step.title}</Text>
              <Text style={styles.hint}>{step.hint}</Text>
            </View>
            {can_open ? (
              <Ionicons name="chevron-forward" size={SIZES.chevron} color={COLORS.text_muted} />
            ) : null}
          </>
        );
        const row_style = [styles.row, index === steps.length - 1 && styles.last];
        if (!can_open) {
          return (
            <View
              key={step.key}
              style={row_style}
              accessible
              accessibilityLabel={step.title + ', ' + step.hint}
            >
              {content}
            </View>
          );
        }
        return (
          <Pressable
            key={step.key}
            onPress={() => openStep(step)}
            accessibilityRole="button"
            accessibilityLabel={step.title + ', ' + step.hint}
            style={({ pressed }) => [...row_style, pressed && styles.pressed]}
          >
            {content}
          </Pressable>
        );
      })}
      <Button
        variant="tertiary"
        size="small"
        title="Hide this for good"
        accessibilityHint="The setup checklist won't come back on this phone"
        onPress={dismiss}
        style={styles.hide}
      />
      {schedule_open && target ? (
        <ScheduleFormModal
          visible
          place={target.tenant_name + (target.property_name ? ', ' + target.property_name : '')}
          schedule={target.schedule}
          today={ledger_store.today}
          onSubmit={saveSchedule}
          onClose={() => setScheduleOpen(false)}
        />
      ) : null}
    </View>
  );
}

export default OnboardingCard;

const styles = themedStyles((COLORS) => ({
  box: {
    marginBottom: SPACING.lg,
  },
  progress: {
    marginBottom: SPACING.sm,
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
  pressed: {
    opacity: OPACITY.pressed,
  },
  words: {
    flex: 1,
  },
  title: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  title_done: {
    color: COLORS.text_muted,
    textDecorationLine: 'line-through',
  },
  hint: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  // lined up with the rows' left edge, the tap area still reaches 44 with the button's hitSlop
  hide: {
    alignSelf: 'flex-start',
    marginHorizontal: 0,
    paddingHorizontal: 0,
    marginTop: SPACING.sm,
  },
}));
