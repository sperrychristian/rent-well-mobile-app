import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FormSheet from '../../payments/components/FormSheet';
import { Field, form_styles } from '../../payments/components/FormBits';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import { useToast } from '../../../components/ui/Toast';
import { hapticSuccess } from '../../../utils/haptics';
import { formatCents } from '../../../utils/formatCurrency';
import { useReminders } from '../hooks/useReminders';
import {
  max_reminder_length,
  shortSentDate,
  canSendLine,
  formatLongDate,
} from '../utils/reminderHelpers';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

const kind_options = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'overdue_notice', label: 'Overdue notice' },
];

// the words for the three reasons nothing can be sent, and the server's errors that mean the same thing
function blockedLine(code, can_send_at) {
  if (code === 'NOTHING_OWED') {
    return "Nothing is owed right now, so there's nothing to remind them about.";
  }
  if (code === 'NO_ACTIVE_TENANCY') {
    return 'This tenancy has ended, so reminders are off.';
  }
  if (code === 'REMINDER_TOO_SOON') {
    return can_send_at
      ? 'One reminder every 24 hours. ' + canSendLine(can_send_at)
      : 'One reminder every 24 hours.';
  }
  return null;
}

// one tap to nudge a tenant who owes rent: pick friendly or an overdue notice, read (and edit) the suggested
// text, then Send. It goes into the chat with them as a message from you, and they get a push that opens
// Payments. Nothing is ever sent on its own.
// props: visible, tenancy_id, place, tenant_name, onClose
function ReminderSheet(props) {
  const toast = useToast();
  const reminders = useReminders();
  const [kind, setKind] = useState('friendly');
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reminders_ref = useRef(reminders);
  useEffect(() => {
    reminders_ref.current = reminders;
  });

  // a new suggestion for each kind, which replaces whatever was typed for the other one
  useEffect(() => {
    let showing = true;
    reminders_ref.current
      .preview(props.tenancy_id, kind)
      .then((result) => {
        if (!showing) {
          return;
        }
        setPreview(result);
        setText(result.message_text);
        setBlocked(
          result.can_send_now
            ? null
            : { code: 'REMINDER_TOO_SOON', can_send_at: result.can_send_at },
        );
        setError('');
        setLoading(false);
      })
      .catch((preview_error) => {
        if (!showing) {
          return;
        }
        setPreview(null);
        setLoading(false);
        if (blockedLine(preview_error.code)) {
          setBlocked({ code: preview_error.code, can_send_at: null });
        } else {
          setError(preview_error.message);
        }
      });
    return () => {
      showing = false;
    };
  }, [props.tenancy_id, kind]);

  function pickKind(next) {
    if (next !== kind) {
      setLoading(true);
      setKind(next);
    }
  }

  async function send() {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setError('Write a message, or switch the kind to get the suggested one back.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reminders.send(props.tenancy_id, kind, trimmed);
      hapticSuccess();
      toast.show(
        'Reminder sent to ' + (props.tenant_name || 'your tenant'),
        'notifications-outline',
      );
      props.onClose();
    } catch (send_error) {
      setBusy(false);
      const can_send_at = send_error.info ? send_error.info.canSendAt : null;
      if (blockedLine(send_error.code, can_send_at)) {
        setBlocked({ code: send_error.code, can_send_at: can_send_at });
      } else {
        setError(send_error.message);
      }
    }
  }

  const blocked_text = blocked ? blockedLine(blocked.code, blocked.can_send_at) : null;
  const can_edit = !loading && preview && !blocked;

  return (
    <FormSheet
      visible={props.visible}
      title="Send Reminder"
      subtitle={(props.tenant_name ? props.tenant_name + ', ' : '') + props.place}
      error={error}
      submit_label="Send"
      submit_icon="notifications-outline"
      submit_disabled={!can_edit}
      busy={busy}
      onSubmit={send}
      onClose={props.onClose}
    >
      <SegmentedControl
        label="Kind of reminder"
        options={kind_options}
        value={kind}
        onChange={pickKind}
      />

      {loading ? <ActivityIndicator color={COLORS.text_muted} style={styles.loading} /> : null}

      {!loading && preview ? (
        <Text style={styles.owed}>
          {formatCents(preview.amount_cents) +
            ' owed' +
            (preview.due_on ? ', due ' + formatLongDate(preview.due_on) : '')}
        </Text>
      ) : null}

      {blocked_text ? (
        <View style={styles.blocked} accessibilityLiveRegion="polite">
          <Ionicons
            name="information-circle-outline"
            size={SIZES.icon}
            color={COLORS.warning_text}
          />
          <Text style={styles.blocked_text}>{blocked_text}</Text>
        </View>
      ) : null}

      {!loading && preview ? (
        <Field label="Message" helper={text.length + ' of ' + max_reminder_length + ' characters'}>
          <TextInput
            value={text}
            onChangeText={setText}
            editable={!!can_edit}
            multiline
            maxLength={max_reminder_length}
            accessibilityLabel="Reminder message"
            accessibilityHint={text.length + ' of ' + max_reminder_length + ' characters'}
            style={[form_styles.input, styles.message, !can_edit && styles.message_off]}
          />
        </Field>
      ) : null}

      {preview && preview.last_reminder_at ? (
        <Text style={styles.last}>
          {'Last reminder sent ' + shortSentDate(preview.last_reminder_at)}
        </Text>
      ) : null}
    </FormSheet>
  );
}

export default ReminderSheet;

const styles = StyleSheet.create({
  loading: {
    marginVertical: SPACING.lg,
  },
  owed: {
    ...TYPE.subheading,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  blocked: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
    marginVertical: SPACING.sm,
  },
  blocked_text: {
    ...TYPE.body_small,
    color: COLORS.warning_text,
    flex: 1,
  },
  message: {
    minHeight: SIZES.button_large * 3,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },
  message_off: {
    color: COLORS.text_muted,
  },
  last: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.xs,
  },
});
