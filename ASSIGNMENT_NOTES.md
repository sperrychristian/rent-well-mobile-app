# Assignment notes (DRAFT, rewrite in your own words)

Screen audited: `screens/NewWorkOrderScreen.js` (tenant "Report an Issue").
Tested on iPhone SE and iPad, portrait and landscape.

Note on order: the top-inset fix (pushing the title below the status bar) and the property chip fix were made in an earlier step, after the before screenshots and before the three fixes below.

## What changed
- Added `useSafeAreaInsets` and applied the top, bottom, left, and right insets to the screen padding.
- Wrapped the form in a `KeyboardAvoidingView` with a `ScrollView` inside (`keyboardShouldPersistTaps="handled"`).
- Used `useWindowDimensions` to detect landscape and shrink the photo preview from 160 to 120 tall.
- Capped the form at 600 wide and centered it so it does not stretch across a tablet.
- Separate bug: set `flexGrow: 0` on the horizontal property chip list.

## Fix 1: Safe area
The app hides the navigation header, so nothing was keeping the screen away from the notch, status bar, or home indicator, and the title was pressed against the top. I used `useSafeAreaInsets` from `react-native-safe-area-context` and added each inset to the screen's normal padding. The top and bottom insets clear the status bar and home indicator, and the left and right insets keep content away from the notch in landscape.

## Fix 2: Keyboard
The form was a plain `View`, so when the keyboard opened it could cover the Details field and the Submit button, and there was no way to scroll to them. I wrapped the form in a `KeyboardAvoidingView` with a `ScrollView` inside, so the screen makes room for the keyboard and the user can scroll to any field. `keyboardShouldPersistTaps="handled"` lets a tap on a chip or button work on the first try while the keyboard is open.

Platform.OS: I used `Platform.OS` to set the `KeyboardAvoidingView` behavior to `padding` on iOS and leave it unset on Android, because iOS does not resize the app when the keyboard opens but Android already moves the content up on its own (this follows the Expo keyboard handling guide).

## Fix 3: Layout with useWindowDimensions
On the iPad the form stretched edge to edge, which made the fields very wide and hard to read, and in landscape on the iPhone SE the photo preview took up most of the short screen. I capped the form at 600 wide and centered it, so it looks the same on a tablet as on a phone. I used `useWindowDimensions` to check whether the screen is wider than it is tall, and in that case the photo preview shrinks to 120 tall.

## Separate bug (not one of the three required fixes)
The horizontal list of property chips was growing to fill the spare height on the screen, so the chips looked too tall. Setting `flexGrow: 0` on that list keeps it only as tall as the chips.
