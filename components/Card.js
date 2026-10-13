import { StyleSheet } from 'react-native';
import UiCard from './ui/Card';
import { SPACING } from '../theme';

// the old Card keeps its place in the layout (90% wide, centered, space above and below) so no screen moves,
// the look comes from the raised card in components/ui now
function Card(props) {
  return <UiCard style={[styles.card, props.style]}>{props.children}</UiCard>;
}

export default Card;

const styles = StyleSheet.create({
  card: {
    marginVertical: SPACING.md,
    width: '90%',
    alignSelf: 'center',
  },
});
