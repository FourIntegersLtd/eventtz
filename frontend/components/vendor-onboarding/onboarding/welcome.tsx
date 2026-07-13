import { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CoupleSleeping from "@/assets/images/vectors/couple-sleeping.svg";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { PrimaryButton, GhostButton } from "@/components/ui/buttons";
import { ScreenBackgroundWithContent } from "@/components/ScreenBackground";
import { text, spacing, type } from "@/constants/theme";

/** couple-sleeping.svg viewBox 3000×1688 — full-bleed */
const ILLUST_ASPECT = 1688 / 3000;
/** Scale illustration so it appears larger (more vertical space) */
const ILLUST_SIZE_SCALE = 1.35;

/** Step 1 — Welcome: full-screen gradient, illustration, display-lg title, Get Started + Log in (spec) */
export default function OnboardingWelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { session, isOnboarded } = useAuth();
  const { goNext } = useOnboarding();

  const illustWidth = windowWidth;
  const illustHeight = Math.round(illustWidth * ILLUST_ASPECT * ILLUST_SIZE_SCALE);

  useEffect(() => {
    if (session && isOnboarded) {
      router.replace("/(tabs)");
    }
  }, [session, isOnboarded, router]);

  const handleGetStarted = () => {
    goNext();
    router.push("/(onboarding)/wizard");
  };

  return (
    <ScreenBackgroundWithContent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.welcomeTo}>Welcome to</Text>
        <View style={styles.illustWrap}>
          <View style={[styles.illustClip, { width: illustWidth, height: illustHeight }]}>
            <CoupleSleeping width={illustWidth} height={illustHeight} />
          </View>
        </View>
        <Text style={styles.title}>QuietNight</Text>
        <Text style={styles.subtitle}>
          The app that helps couples sleep better — together.
        </Text>
        <View style={styles.buttonWrap}>
          <PrimaryButton label="Let's Get Started" onPress={handleGetStarted} />
        </View>
        <GhostButton
          label="Already have an account? Log in"
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>
    </ScreenBackgroundWithContent>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.screenPadding,
  },
  welcomeTo: {
    ...type.displayLg,
    color: text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  illustWrap: { marginBottom: -spacing.lg, marginHorizontal: -spacing.screenPadding },
  illustClip: { overflow: "hidden" },
  title: {
    ...type.displayLg,
    color: text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...type.bodyLg,
    color: text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  buttonWrap: { marginTop: spacing.md },
});
