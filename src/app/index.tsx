import { useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing 
} from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function SplashScreen() {
  const router = useRouter();

  // Animation values
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);
  const textTranslateY = useSharedValue(20);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // Logo entrance animation
    logoScale.value = withTiming(1.0, {
      duration: 1000,
      easing: Easing.out(Easing.back(1.5)),
    });
    logoOpacity.value = withTiming(1.0, { duration: 800 });

    // Glow pulse animation
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite
      true
    );

    // Text slide up
    textTranslateY.value = withTiming(0, {
      duration: 800,
      easing: Easing.out(Easing.ease),
    });
    textOpacity.value = withTiming(1, { duration: 1000 });

    // Redirect to login screen after 3.2 seconds
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 3200);

    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: 1.1 + glowOpacity.value * 0.15 }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: textTranslateY.value }],
    opacity: textOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Animated Glow Behind Logo */}
        <Animated.View style={[styles.logoGlowContainer, glowStyle]}>
          <Image
            source={require('@/assets/images/logo-glow.png')}
            style={styles.logoGlow}
            contentFit="cover"
          />
        </Animated.View>

        {/* Animated Logo */}
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Image
            source={require('@/assets/images/plugus-logo.jpg')}
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>

        {/* Brand Text */}
        <Animated.View style={[styles.brandContainer, textStyle]}>
          <ThemedText style={styles.subtitle}>YOUR LOCAL SERVICES, PLUGGED IN</ThemedText>
        </Animated.View>

        {/* Spinner */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#9C3FEF" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10', // Dark premium background
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9C3FEF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  logo: {
    width: 220,
    height: 220,
  },
  logoGlowContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGlow: {
    width: 200,
    height: 200,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: Spacing.five,
  },
  title: {
    fontSize: 44,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B0B4BA',
    letterSpacing: 2,
    marginTop: Spacing.two,
  },
  loadingContainer: {
    marginTop: Spacing.six,
    height: 40,
    justifyContent: 'center',
  },
});
