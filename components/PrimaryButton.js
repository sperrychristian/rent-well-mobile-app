import {Text, StyleSheet, Pressable} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../theme'

function PrimaryButton(props) {
    return (
        <Pressable
  onPress={props.onPress}
  style={({ pressed }) => pressed ? [styles.button, styles.pressed] : styles.button}
>
            <Text style={styles.button_text}>{props.title}</Text>
            </Pressable>

    );
}

export default PrimaryButton;

const styles = StyleSheet.create({
    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: 8,
        marginHorizontal: SPACING.sm
    },
    pressed: {
        opacity: .7,
    },
    button_text: {
        color: COLORS.text,
        fontSize: FONT_SIZES.body,
        fontWeight: 'bold',
        textAlign: 'center',
    }
})