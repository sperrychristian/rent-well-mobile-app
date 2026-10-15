import { StyleSheet } from 'react-native';
import UiCard from './ui/Card';
import { SPACING } from '../theme';

// the old Card keeps its place in the layout (90% wide, centered, space above and below) so no screen moves,
// the look comes from the raised card in components/ui now
// the fintech pass made it full width so cards line up with the buttons and search boxes around them,
// screens give it their own side padding
function Card(props) {
  return <UiCard style={[styles.card, props.style]}>{props.children}</UiCard>;
}

export default Card;

const styles = StyleSheet.create({
  // space above only, so stacked cards sit one even step apart instead of two
  card: {
    marginTop: SPACING.md,
    width: '100%',
    alignSelf: 'center',
  },
});
