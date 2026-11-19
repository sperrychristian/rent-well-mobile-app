import { useState } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from '../forms/Input';
import { COLORS, SIZES } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';

// the lecture's auth Input (label, value, onUpdateValue, secure, keyboardType, isInvalid), built on the
// work order form's Input so it gets the same box, the error under it, and the screen reader hint
// props from the lecture: label, value, onUpdateValue, secure, keyboardType, isInvalid
// props Rent Well adds: errorText, helperText, inputRef, returnKeyType, onSubmitEditing, autoComplete,
//   textContentType (so iOS password managers know the box), autoCapitalize, placeholder, editable
function AuthInput(props) {
  // a password starts hidden, the eye button shows it while you check what you typed
  const [hidden, setHidden] = useState(true);

  const toggle = props.secure ? (
    <Pressable
      onPress={() => setHidden((value) => !value)}
      accessibilityRole="button"
      accessibilityLabel={
        hidden ? 'Show ' + props.label.toLowerCase() : 'Hide ' + props.label.toLowerCase()
      }
      hitSlop={4}
      style={({ pressed }) => [styles.eye, pressed && styles.eye_pressed]}
    >
      <Ionicons
        name={hidden ? 'eye-outline' : 'eye-off-outline'}
        size={SIZES.icon}
        color={COLORS.text_muted}
      />
    </Pressable>
  ) : null;

  return (
    <Input
      label={props.label}
      invalid={props.isInvalid}
      errorText={props.errorText}
      helperText={props.helperText}
      accessory={toggle}
      textInputConfig={{
        ref: props.inputRef,
        value: props.value,
        onChangeText: props.onUpdateValue,
        secureTextEntry: props.secure ? hidden : false,
        keyboardType: props.keyboardType || 'default',
        autoCapitalize: props.autoCapitalize || 'none',
        autoCorrect: false,
        spellCheck: false,
        autoComplete: props.autoComplete,
        textContentType: props.textContentType,
        returnKeyType: props.returnKeyType,
        onSubmitEditing: props.onSubmitEditing,
        // the next box takes the focus, so the keyboard shouldn't drop between them
        submitBehavior: props.returnKeyType === 'next' ? 'submit' : 'blurAndSubmit',
        placeholder: props.placeholder,
        editable: props.editable,
      }}
    />
  );
}

export default AuthInput;

const styles = themedStyles((COLORS) => ({
  // a full 44pt square next to the box
  eye: {
    width: SIZES.touch,
    minHeight: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZES.touch / 2,
  },
  eye_pressed: {
    backgroundColor: COLORS.surface_raised,
  },
}));
