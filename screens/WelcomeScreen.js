import { StyleSheet, Text, View, Image } from "react-native";
import { COLORS, SPACING, FONT_SIZES } from "../theme";
import ScreenTitle from "../components/ScreenTitle";
import Card from "../components/Card";
import PrimaryButton from "../components/PrimaryButton";
import { useWorkOrders } from "../context/WorkOrdersContext";

function WelcomeScreen(props) {
  const { startDemo, exitDemo } = useWorkOrders();

  return (
    <View style={styles.container}>
      <Image style={styles.image} source={require('../assets/images/pixel_art_house.png')}/>
      <ScreenTitle>Rent Well</ScreenTitle>
      <Card>
        <Text style={styles.body_text}>Property Management Made Simple</Text>
      </Card>
      <View style={styles.button_container}>
        {/* login always starts in real mode, so I leave the demo first if someone swiped back out of it */}
        <PrimaryButton
          title="Login"
        />
        <PrimaryButton title="Sign Up" />
      </View>
      {/* the demo needs no account, it starts on fresh sample data and never saves */}
      <PrimaryButton
        title="Try the Demo"
        icon="play-circle-outline"
        style={styles.demo_button}
        onPress={() => {
          startDemo();
          props.navigation.navigate("Dashboard");
        }}
      />
    </View>
  );
}

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },

  body_text: {
    color: COLORS.text,
    fontSize: FONT_SIZES.body,
    textAlign: "center",
  },

  button_container: {
    flexDirection: "row",
    margin: SPACING.sm,
  },
  image: {
    width: 400,
    height: 200,
    resizeMode: "contain",
    marginBottom: SPACING.md,
    opacity: .95
  },
  demo_button: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginHorizontal: 0,
    marginTop: SPACING.sm,
  },
});
