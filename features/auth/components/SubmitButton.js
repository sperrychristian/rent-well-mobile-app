import { View, StyleSheet } from 'react-native';
import Button from '../../../components/ui/Button';
import { SPACING } from '../../../theme';

// a PrimaryButton that shows a spinner and ignores taps while the request is out
// props: title, busy_title, busy, onPress
// the design pass made it the amber primary button with the spinner inside it instead of next to it
function SubmitButton(props) {
  return (
    <View style={styles.row}>
      <Button
        title={props.busy ? props.busy_title : props.title}
        variant="primary"
        loading={props.busy}
        onPress={props.onPress}
        style={styles.button}
      />
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
  },
});
