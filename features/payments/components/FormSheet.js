import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// the pop-up forms share the sheet look from components/ui
import ModalCard from '../../../components/ui/ModalCard';
import Button from '../../../components/ui/Button';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';
import { COLORS, SPACING, TYPE } from '../../../theme';

// the frame every payments form sits in: a sheet over a dim backdrop, a title and a line under it,
// the fields, a form-level error, and Cancel on the left with the main action on the right
// props: visible, title, subtitle, children, error, submit_label, submit_icon, submit_variant, busy,
//   onSubmit, onClose
// (submit_disabled greys out the main action, the rent reminder sheet uses it when nothing can be sent)
function FormSheet(props) {
  // with Reduce Motion on the sheet just appears, no slide
  const reduce_motion = useReduceMotion();
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType={reduce_motion ? 'none' : 'slide'}
      onRequestClose={props.onClose}
    >
      <View style={styles.root}>
        {/* iOS needs padding to lift the form, Android already resizes the window so it uses height */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll_content}
            keyboardShouldPersistTaps="handled"
          >
            <ModalCard>
              <Text style={styles.heading} accessibilityRole="header">
                {props.title}
              </Text>
              {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
              {props.children}
              {props.error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {props.error}
                </Text>
              ) : null}
              <View style={styles.button_row}>
                <Button
                  variant="secondary"
                  title="Cancel"
                  onPress={props.onClose}
                  style={styles.button}
                />
                <Button
                  variant={props.submit_variant || 'primary'}
                  title={props.submit_label}
                  icon={props.submit_icon}
                  loading={props.busy}
                  disabled={props.submit_disabled}
                  onPress={props.onSubmit}
                  style={styles.button}
                />
              </View>
            </ModalCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default FormSheet;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
  },
  scroll_content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
  },
  subtitle: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.xxs,
    marginBottom: SPACING.md,
  },
  error: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    marginTop: SPACING.xs,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  button: {
    flex: 1,
    marginHorizontal: 0,
  },
});
