import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from './theme'
import ScreenTitle from './components/ScreenTitle';
import Card from './components/Card'
import PrimaryButton from './components/PrimaryButton'

export default function App() {
  return (
    <View style={styles.container}>
      <ScreenTitle>Rent Well</ScreenTitle>
      <Card>
        <Text style={styles.body_text}>Property Management Made Simple</Text>
      </Card>
      <View style={styles.button_container}>
      <PrimaryButton title='Login' style={styles.button_styling} />
      <PrimaryButton title='Sign Up' style={styles.button_styling}/>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },

  body_text: {
    colors: COLORS.text,
    fontSize: FONT_SIZES.body,
    textAlign: 'center'
  },

  button_container: {
    flexDirection: 'row',
    margin: SPACING.sm,
  },

});
