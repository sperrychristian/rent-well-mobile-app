import {Text, StyleSheet} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme'

function ScreenTitle (props) {
    return(
    <Text style={styles.title}>{props.children}</Text>
    )
}

export default ScreenTitle;

const styles = StyleSheet.create({
    title: {
        fontSize: FONT_SIZES.title,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.md,
        textAlign: 'center'
    }
})