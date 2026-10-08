import { useRef, useEffect, useState } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme'

// used AI to help create a shimmer behind each screen title

function ScreenTitle (props) {
    // I need the card width so I know how far the shine has to travel
    const [card_width, setCardWidth] = useState(0);
    const shimmer_value = useRef(new Animated.Value(0)).current;

    // I loop the sweep forever, with a rest between passes
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer_value, { toValue: 1, duration: 3000, useNativeDriver: true }),
                Animated.delay(2000),
                // I snap it back to the start while it's off the card so the next pass begins clean
                Animated.timing(shimmer_value, { toValue: 0, duration: 0, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const slide_x = shimmer_value.interpolate({
        inputRange: [0, 1],
        outputRange: [-card_width, card_width],
    });

    return(
        // overflow hidden keeps the shine clipped to the rounded corners
        <View
            style={styles.card}
            onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
        >
            {/* the moving shine sits behind the text */}
            <Animated.View
                pointerEvents='none'
                style={[StyleSheet.absoluteFill, { transform: [{ translateX: slide_x }] }]}
            >
                <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                />
            </Animated.View>
            {/* the title itself never moves */}
            <Text style={styles.title}>{props.children}</Text>
        </View>
    )
}

export default ScreenTitle;

const styles = StyleSheet.create({
    card: {
        alignSelf: 'stretch',
        backgroundColor: COLORS.title,
        borderRadius: 12,
        overflow: 'hidden',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.title,
        fontFamily: FONTS.heading,
        color: COLORS.title_text,
        textAlign: 'center',
        letterSpacing: 0.5,
    }
})