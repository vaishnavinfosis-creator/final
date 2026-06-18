import { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  TextInput, 
  Pressable, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Focus states
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Reanimated values for button press scaling
  const buttonScale = useSharedValue(1);

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 10 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1.0, { damping: 10 });
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Ambient Neon glows */}
        <View style={styles.ambientGlowTop} />
        <View style={styles.ambientGlowBottom} />

        <View style={styles.header}>
          <Image
            source={require('@/assets/images/plugus-logo.jpg')}
            style={styles.logo}
            contentFit="contain"
          />
          <ThemedText style={styles.title}>Welcome back</ThemedText>
          <ThemedText style={styles.subtitle}>Enter your details to access your plugus account</ThemedText>
        </View>

        {/* Glassmorphic Form Card */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Email Address</ThemedText>
            <TextInput
              style={[
                styles.input, 
                emailFocused && styles.inputActive
              ]}
              placeholder="e.g. hello@plugus.co"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.passwordHeader}>
              <ThemedText style={styles.inputLabel}>Password</ThemedText>
              <Pressable>
                <ThemedText style={styles.forgotText}>Forgot password?</ThemedText>
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.input, 
                passwordFocused && styles.inputActive
              ]}
              placeholder="••••••••••••"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          {/* Animated Log In Button */}
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleLogin}
            disabled={loading}
            style={styles.buttonWrapper}
          >
            <Animated.View style={[styles.button, animatedButtonStyle]}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.buttonText}>Log In</ThemedText>
              )}
            </Animated.View>
          </Pressable>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Don't have an account?{' '}
            <ThemedText 
              style={styles.signupLink}
              onPress={() => router.push('/signup')}
            >
              Sign up
            </ThemedText>
          </ThemedText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050608', // Ultra deep sleek dark
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#9C3FEF',
    opacity: 0.12,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#00E5FF',
    opacity: 0.08,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.five,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#B0B4BA',
    textAlign: 'center',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.four,
    gap: Spacing.four,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 5,
  },
  inputGroup: {
    gap: Spacing.two,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9C3FEF',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: Spacing.three,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  inputActive: {
    borderColor: '#9C3FEF',
    backgroundColor: 'rgba(156, 63, 239, 0.04)',
    shadowColor: '#9C3FEF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  buttonWrapper: {
    marginTop: Spacing.two,
  },
  button: {
    backgroundColor: '#9C3FEF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9C3FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.five,
  },
  footerText: {
    fontSize: 14,
    color: '#B0B4BA',
    fontWeight: '500',
  },
  signupLink: {
    color: '#00E5FF',
    fontWeight: '700',
  },
});
