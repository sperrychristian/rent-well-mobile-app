import { View, Text, StyleSheet } from 'react-native';
import PixelArt from './pixel/PixelArt';
import Button from './Button';
import { COLORS, SPACING, TYPE, SIZES } from '../../theme';

// what a list shows when there's nothing in it: a small pixel drawing, a title, one line, and maybe a button
// props: illustration (empty_work_orders, empty_messages, empty_tenants, empty_documents, empty_checklists,
//   empty_expenses, empty_payments), title, message, action_label, onAction, action_icon, style
function EmptyState(props) {
  return (
    <View style={[styles.box, props.style]}>
      {props.illustration ? (
        <View style={styles.art}>
          <PixelArt name={props.illustration} pixel={5} />
        </View>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {props.title}
      </Text>
      {props.message ? <Text style={styles.message}>{props.message}</Text> : null}
      {props.action_label ? (
        <Button
          title={props.action_label}
          icon={props.action_icon}
          variant="secondary"
          size="small"
          onPress={props.onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

export default EmptyState;

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  art: {
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPE.heading,
    color: COLORS.text,
    textAlign: 'center',
  },
  message: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    maxWidth: SIZES.content_max_width,
  },
  action: {
    marginTop: SPACING.md,
  },
});
