import { View, ActivityIndicator, StyleSheet } from 'react-native';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING } from '../../../theme';

// a PrimaryButton that shows a spinner and ignores taps while the request is out
// props: title, busy_title, busy, onPress
function SubmitButton(props) {
  return (
    <View style={styles.row}>
      <PrimaryButton
        title={props.busy ? props.busy_title : props.title}
        text_color={COLORS.text_light}
        onPress={props.busy ? undefined : props.onPress}
        style={[styles.button, props.busy && styles.busy]}
      />
      {props.busy && <ActivityIndicator color={COLORS.action} style={styles.spinner} />}
    </View>
  );
}

export default SubmitButton;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.success,
  },
  busy: {
    opacity: 0.7,
  },
  spinner: {
    marginLeft: SPACING.sm,
  },
});
