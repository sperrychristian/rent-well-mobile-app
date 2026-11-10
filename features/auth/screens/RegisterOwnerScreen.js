import { useState } from 'react';
import { Text, Pressable, View } from 'react-native';
import AuthLayout from '../components/AuthLayout';
import SubmitButton from '../components/SubmitButton';
import TextField from '../../../components/TextField';
import { useAuth, homeRouteFor } from '../../../store/AuthContext';
import { checkEmail, checkName, collectErrors } from '../utils/authValidation';
import { SPACING, TYPE, SIZES } from '../../../constants/theme';
import { themedStyles } from '../../../util/themedStyles';

function RegisterOwnerScreen(props) {
  const { registerOwner } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [field_errors, setFieldErrors] = useState({});
  const [server_error, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRegister() {
    const errors = collectErrors({
      name: checkName(name, true),
      email: checkEmail(email),
    });
    setFieldErrors(errors);
    setServerError('');
    if (Object.keys(errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      const user = await registerOwner({
        name: name.trim(),
        email: email.trim(),
      });
      props.navigation.reset({ index: 0, routes: [{ name: homeRouteFor(user) }] });
    } catch (error) {
      setFieldErrors(error.field_errors || {});
      setServerError(error.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Landlord Sign Up"
      subtitle="Create a landlord account for your properties."
      error={server_error}
      footer={
        <View style={styles.links}>
          <Pressable
            onPress={() => props.navigation.navigate('RegisterTenant')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.link_press}
          >
            <Text style={styles.link}>Renting? Sign up with your invite code</Text>
          </Pressable>
          <Pressable
            onPress={() => props.navigation.navigate('Login')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.link_press}
          >
            <Text style={styles.link}>Already have an account? Pick a test account</Text>
          </Pressable>
        </View>
      }
    >
      <TextField
        label="Your name"
        value={name}
        onChangeText={setName}
        error={field_errors.name}
        placeholder="Full name"
        textContentType="name"
        autoComplete="name"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={field_errors.email}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        onSubmitEditing={handleRegister}
      />
      {/* milestone 2 has no passwords, Firebase Auth adds them next milestone */}
      <Text style={styles.note}>
        No password yet: this makes a test account, and real sign in comes with Firebase Auth.
      </Text>
      <SubmitButton
        title="Create Account"
        busy_title="Creating account..."
        busy={busy}
        onPress={handleRegister}
      />
    </AuthLayout>
  );
}

export default RegisterOwnerScreen;

const styles = themedStyles((COLORS) => ({
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
  note: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  link: {
    ...TYPE.subheading,
    color: COLORS.cta,
    textAlign: 'center',
  },
}));
