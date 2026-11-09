// shared steps for the empty state tests: open the real App in the demo or signed in to a test account,
// go to a screen, and type in a search box (not a test file itself, the two test files import it)
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, { forgetNavigationState } from '../App';
import { navigation_ref } from '../util/navigationRef';

export async function settle(rounds) {
  for (let index = 0; index < (rounds || 6); index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

export async function openDemo() {
  await AsyncStorage.clear();
  forgetNavigationState();
  render(<App />);
  await settle();
  fireEvent.press(await screen.findByText('Try the Demo'));
  await settle();
  fireEvent.press(screen.getByLabelText('Demo as Landlord'));
  await settle();
}

export async function openAs(firebase, user_id) {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    'rent_well_test_account',
    JSON.stringify(firebase.database.dump().users[user_id]),
  );
  forgetNavigationState();
  render(<App />);
  await settle(10);
}

export async function go(route_name) {
  act(() => navigation_ref.navigate(route_name));
  await settle();
}

export function search(placeholder, text) {
  fireEvent.changeText(screen.getByPlaceholderText(placeholder), text);
}

export async function press(element) {
  fireEvent.press(element);
  await settle();
}
