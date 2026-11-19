import { useState } from 'react';
import { View } from 'react-native';
import AuthInput from './AuthInput';
import Button from '../ui/Button';
import { SPACING } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';

// the lecture's AuthForm: it holds what's typed in state, updateInputValueHandler(inputType, enteredValue)
// changes one box, and the button sends everything up to AuthContent
// mode is 'login' (email and password), 'owner' (name, email twice, password twice),
// or 'tenant' (the invite code, an optional name, email twice, password twice)
// props: mode, credentialsInvalid (a message per box that's wrong), onSubmit, onEdit (a box changed),
//   isAuthenticating, submitTitle
function AuthForm(props) {
  const is_login = props.mode === 'login';
  const [enteredInviteCode, setEnteredInviteCode] = useState('');
  const [enteredName, setEnteredName] = useState('');
  const [enteredEmail, setEnteredEmail] = useState('');
  const [enteredConfirmEmail, setEnteredConfirmEmail] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [enteredConfirmPassword, setEnteredConfirmPassword] = useState('');

  // every box's element, so Next on the keyboard moves to the box after it
  // (a plain object kept for the life of the form, only touched from the box callbacks, never while drawing)
  const [boxes] = useState(() => ({}));

  const invalid = props.credentialsInvalid || {};

  // step 1: one handler for every box, the lecture's switch on inputType
  function updateInputValueHandler(inputType, enteredValue) {
    if (props.onEdit) {
      props.onEdit(inputType);
    }
    switch (inputType) {
      case 'invite_code':
        setEnteredInviteCode(enteredValue);
        break;
      case 'name':
        setEnteredName(enteredValue);
        break;
      case 'email':
        setEnteredEmail(enteredValue);
        break;
      case 'confirmEmail':
        setEnteredConfirmEmail(enteredValue);
        break;
      case 'password':
        setEnteredPassword(enteredValue);
        break;
      case 'confirmPassword':
        setEnteredConfirmPassword(enteredValue);
        break;
    }
  }

  // step 2: the button (or Done on the last box) sends everything up, AuthContent checks it
  function submitHandler() {
    if (props.isAuthenticating) {
      return;
    }
    props.onSubmit({
      invite_code: enteredInviteCode,
      name: enteredName,
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      password: enteredPassword,
      confirmPassword: enteredConfirmPassword,
    });
  }

  // the boxes in order for this mode, so Next always knows which one comes after
  const order = is_login
    ? ['email', 'password']
    : [
        ...(props.mode === 'tenant' ? ['invite_code'] : []),
        'name',
        'email',
        'confirm_email',
        'password',
        'confirm_password',
      ];

  function focusBox(field) {
    const box = boxes[field];
    if (box) {
      box.focus();
    }
  }

  function keyProps(field) {
    const index = order.indexOf(field);
    const is_last = index === order.length - 1;
    return {
      inputRef: (node) => {
        boxes[field] = node;
      },
      returnKeyType: is_last ? 'done' : 'next',
      onSubmitEditing: is_last ? submitHandler : () => focusBox(order[index + 1]),
      editable: !props.isAuthenticating,
    };
  }

  return (
    <View>
      {props.mode === 'tenant' ? (
        <AuthInput
          label="Invite code"
          value={enteredInviteCode}
          onUpdateValue={(value) => updateInputValueHandler('invite_code', value)}
          isInvalid={!!invalid.invite_code}
          errorText={invalid.invite_code}
          // the hint lives in the field now, so it sits under the box and swaps out for an error
          helperText="Your landlord sends this. Dashes and spaces are fine."
          placeholder="K7M2-QX9P"
          autoCapitalize="characters"
          autoComplete="off"
          textContentType="oneTimeCode"
          {...keyProps('invite_code')}
        />
      ) : null}
      {!is_login ? (
        <AuthInput
          label={props.mode === 'tenant' ? 'Your name (optional)' : 'Your name'}
          value={enteredName}
          onUpdateValue={(value) => updateInputValueHandler('name', value)}
          isInvalid={!!invalid.name}
          errorText={invalid.name}
          placeholder={
            props.mode === 'tenant' ? 'Leave blank to use the name on the invite' : 'Full name'
          }
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          {...keyProps('name')}
        />
      ) : null}
      <AuthInput
        label="Email"
        value={enteredEmail}
        onUpdateValue={(value) => updateInputValueHandler('email', value)}
        isInvalid={!!invalid.email}
        errorText={invalid.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoComplete="email"
        // iOS fills the saved login into the box marked username
        textContentType="username"
        {...keyProps('email')}
      />
      {!is_login ? (
        <AuthInput
          label="Confirm email"
          value={enteredConfirmEmail}
          onUpdateValue={(value) => updateInputValueHandler('confirmEmail', value)}
          isInvalid={!!invalid.confirmEmail}
          errorText={invalid.confirmEmail}
          placeholder="Type it again"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          {...keyProps('confirm_email')}
        />
      ) : null}
      <AuthInput
        label="Password"
        value={enteredPassword}
        onUpdateValue={(value) => updateInputValueHandler('password', value)}
        secure
        isInvalid={!!invalid.password}
        errorText={invalid.password}
        helperText={is_login ? undefined : 'At least 8 characters.'}
        autoComplete={is_login ? 'current-password' : 'new-password'}
        textContentType={is_login ? 'password' : 'newPassword'}
        {...keyProps('password')}
      />
      {!is_login ? (
        <AuthInput
          label="Confirm password"
          value={enteredConfirmPassword}
          onUpdateValue={(value) => updateInputValueHandler('confirmPassword', value)}
          secure
          isInvalid={!!invalid.confirmPassword}
          errorText={invalid.confirmPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          {...keyProps('confirm_password')}
        />
      ) : null}
      <View style={styles.buttons}>
        <Button
          title={props.submitTitle || (is_login ? 'Log In' : 'Sign Up')}
          variant="primary"
          loading={props.isAuthenticating}
          onPress={submitHandler}
          style={styles.button}
        />
      </View>
    </View>
  );
}

export default AuthForm;

const styles = themedStyles(() => ({
  buttons: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  button: {
    flex: 1,
    marginHorizontal: 0,
  },
}));
