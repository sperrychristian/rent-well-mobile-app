import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, AccessibilityInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AuthForm from './AuthForm';
import LoadingOverlay from './LoadingOverlay';
import AuthLayout from '../../features/auth/components/AuthLayout';
import {
  checkEmail,
  checkLoginPassword,
  checkNewPassword,
  checkConfirmEmail,
  checkConfirmPassword,
  checkName,
  checkInviteCode,
  collectErrors,
} from '../../features/auth/utils/authValidation';
import { authSetupMessage } from '../../util/auth';
import { SPACING, TYPE, SIZES } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';

// the lecture's AuthContent: credentialsInvalid says which boxes are wrong, submitHandler trims and checks
// everything, and only good input goes on to onAuthenticate. a link switches between the screens with replace
// the lecture only flagged the boxes and showed an Alert, here each box gets its own message under it
// props: mode ('login', 'owner', 'tenant'), onAuthenticate(values), isAuthenticating, loadingMessage,
//   subtitle, submitTitle, serverError (the line at the top), serverFieldErrors (messages from the server
//   that belong under a box), links ([{ label, to }] the screens this one links to)
function AuthContent(props) {
  const navigation = useNavigation();
  const [credentialsInvalid, setCredentialsInvalid] = useState({});
  // the setup message (no database address or API key in .env) wins over everything, the form can't work
  const setup_message = authSetupMessage();
  const form_error = setup_message || props.serverError || '';
  // a double tap can't send two requests, this flips before the parent's state catches up
  const sending = useRef(false);

  useEffect(() => {
    if (!props.isAuthenticating) {
      sending.current = false;
    }
  }, [props.isAuthenticating]);

  // a server error is said out loud once when it shows (iOS doesn't read live regions on its own)
  useEffect(() => {
    if (form_error) {
      AccessibilityInfo.announceForAccessibility(form_error);
    }
  }, [form_error]);

  // step 1: trim, check every box, and flag the wrong ones with their message
  function submitHandler(credentials) {
    if (sending.current || props.isAuthenticating || setup_message) {
      return;
    }
    const email = credentials.email.trim();
    const confirm_email = credentials.confirmEmail.trim();
    const password = credentials.password;
    const is_login = props.mode === 'login';

    const email_error = checkEmail(email);
    const password_error = is_login ? checkLoginPassword(password) : checkNewPassword(password);
    const errors = collectErrors({
      invite_code: props.mode === 'tenant' ? checkInviteCode(credentials.invite_code) : null,
      name: is_login ? null : checkName(credentials.name, props.mode === 'owner'),
      email: email_error,
      // the confirm boxes only complain once the first box is right, so there's one problem at a time
      confirmEmail: is_login || email_error ? null : checkConfirmEmail(email, confirm_email),
      password: password_error,
      confirmPassword:
        is_login || password_error
          ? null
          : checkConfirmPassword(password, credentials.confirmPassword),
    });
    setCredentialsInvalid(errors);
    const fields = Object.keys(errors);
    if (fields.length > 0) {
      AccessibilityInfo.announceForAccessibility(
        fields.length === 1
          ? errors[fields[0]]
          : 'Check the ' + fields.length + ' boxes marked in red.',
      );
      return;
    }
    // step 2: only good input goes on
    sending.current = true;
    props.onAuthenticate({
      invite_code: credentials.invite_code,
      name: credentials.name.trim(),
      email: email,
      password: password,
    });
  }

  // the server's messages for a box sit next to mine, mine win since they're about what's typed now
  const field_errors = { ...(props.serverFieldErrors || {}), ...credentialsInvalid };

  return (
    <View style={styles.fill}>
      <AuthLayout
        subtitle={props.subtitle}
        error={form_error}
        footer={
          <View style={styles.links}>
            {(props.links || []).map((link) => (
              <Pressable
                key={link.to}
                onPress={() => navigation.replace(link.to)}
                hitSlop={8}
                accessibilityRole="link"
                disabled={props.isAuthenticating}
                style={styles.link_press}
              >
                <Text style={styles.link}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        }
      >
        <AuthForm
          mode={props.mode}
          credentialsInvalid={field_errors}
          onSubmit={submitHandler}
          isAuthenticating={props.isAuthenticating}
          submitTitle={props.submitTitle}
        />
      </AuthLayout>
      {props.isAuthenticating ? <LoadingOverlay message={props.loadingMessage} /> : null}
    </View>
  );
}

export default AuthContent;

const styles = themedStyles((COLORS) => ({
  fill: {
    flex: 1,
  },
  links: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  // each link is a full 44pt tall row so it's easy to tap
  link_press: {
    minHeight: SIZES.touch,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  link: {
    ...TYPE.subheading,
    color: COLORS.cta,
    textAlign: 'center',
  },
}));
