import {View, StyleSheet} from 'react-native'
import {COLORS, SPACING } from '../theme'

function Card(props) {
    return(
        <View style={styles.card}>{props.children}</View>
    )
}

export default Card;

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.muted,
        borderRadius: 12,
        padding: SPACING.md,
        marginVertical: SPACING.md,
        width: '90%',
        elevation: 6,
        shadowColor: 'black',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: .3,
        shadowRadius: 6,
    }

})