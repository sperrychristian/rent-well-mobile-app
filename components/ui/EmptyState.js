import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { COLORS, SPACING, TYPE, SIZES } from '../../theme';

// what a list shows when there's nothing in it: a small pixel drawing, a title, one line, and maybe a button
// props: illustration (empty_work_orders, empty_messages, empty_tenants, empty_documents, empty_checklists,
//   empty_expenses, empty_payments), title, message, action_label, onAction, action_icon, style
// the Hearth pass: one muted line icon instead of the drawing (the illustration names still pick it),
// the title in Fraunces, and the button is the one green pill
const illustration_icons = {
  empty_work_orders: 'construct-outline',
  empty_messages: 'chatbubble-outline',
  empty_tenants: 'people-outline',
  empty_documents: 'document-text-outline',
  empty_checklists: 'checkbox-outline',
  empty_expenses: 'receipt-outline',
  empty_payments: 'card-outline',
};

function EmptyState(props) {
  const icon = illustration_icons[props.illustration] || props.icon || 'leaf-outline';
  return (
    <View style={[styles.box, props.style]}>
      <Ionicons
        name={icon}
        size={SIZES.icon_large + SPACING.sm}
        color={COLORS.text_muted}
        style={styles.art}
        accessible={false}
        importantForAccessibility="no"
      />
      <Text style={styles.title} accessibilityRole="header">
        {props.title}
      </Text>
      {props.message ? <Text style={styles.message}>{props.message}</Text> : null}
      {props.action_label ? (
        <Button
          title={props.action_label}
          icon={props.action_icon}
          variant="primary"
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
    ...TYPE.empty_title,
    color: COLORS.text,
    textAlign: 'center',
  },
  message: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    maxWidth: SIZES.content_max_width,
  },
  action: {
    marginTop: SPACING.lg,
  },
});
