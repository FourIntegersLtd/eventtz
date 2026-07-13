import { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import CoupleSleeping from "@/assets/images/vectors/couple-sleeping.svg";
import { PrimaryButton, GhostButton } from "@/components/ui/buttons";
import { ScreenBackgroundWithContent } from "@/components/ScreenBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAlert } from "@/contexts/AlertContext";
import { buildOnboardingPayload, getOrCreateOnboardingAnonymousId } from "@/lib/onboarding-answers";
import { submitOnboardingAnonymous } from "@/lib/api";
import { accent, background, text, type, spacing } from "@/constants/theme";

/** Same as welcome: couple-sleeping.svg full-bleed */
const ILLUST_ASPECT = 1688 / 3000;
const ILLUST_SIZE_SCALE = 1.35;

const GOAL_LABELS_WITH_PARTNER: Record<string, string> = {
  SAME_BED: "Get back to the same bed",
  REDUCE_FOR_PARTNER: "Reduce snoring for your partner",
  SEE_DOCTOR: "See a doctor",
  JUST_TRACK: "Just track your sleep",
};

const GOAL_LABELS_SOLO: Record<string, string> = {
  SAME_BED: "Get back to the same bed",
  REDUCE_FOR_PARTNER: "Reduce my snoring",
  SEE_DOCTOR: "See a doctor",
  JUST_TRACK: "Just track your sleep",
};

export default function OnboardingPaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, completeOnboarding } = useAuth();
  const { answers } = useOnboarding();
  const { currentOffering, purchase, restorePurchases, loading: subLoading } = useSubscription();
  const alertApi = useAlert();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const anonymousIdRef = useRef<string | null>(null);

  const packages = useMemo(
    () =>
      (currentOffering?.availablePackages ?? []).filter(
        (p) => p.packageType === "ANNUAL" || p.packageType === "MONTHLY",
      ),
    [currentOffering],
  );

  useEffect(() => {
    if (packages.length > 0 && !selectedPlan) {
      const annual = packages.find((p) => p.packageType === "ANNUAL");
      setSelectedPlan(annual?.identifier ?? packages[0].identifier);
    }
  }, [packages, selectedPlan]);

  // Save onboarding to backend for user research (whether or not they create an account)
  useEffect(() => {
    const payload = buildOnboardingPayload(answers);
    const anonymousId = getOrCreateOnboardingAnonymousId();
    anonymousIdRef.current = anonymousId;
    submitOnboardingAnonymous(anonymousId, payload as Record<string, unknown>).catch(() => {
      // ignore; backend may be unreachable
    });
  }, []); // run once on mount; answers are stable by paywall

  const plans = useMemo(
    () =>
      packages.map((pkg) => ({
        id: pkg.identifier,
        label:
          pkg.packageType === "ANNUAL"
            ? "Annual"
            : pkg.packageType === "MONTHLY"
              ? "Monthly"
              : pkg.product.title ?? "Subscribe",
        price: pkg.product.priceString,
        save: pkg.packageType === "ANNUAL" ? "BEST VALUE" : null,
      })),
    [packages],
  );

  const illustWidth = width;
  const illustHeight = Math.round(illustWidth * ILLUST_ASPECT * ILLUST_SIZE_SCALE);

  const targetWeeks = answers.target_weeks ?? 4;
  const primaryGoal = answers.primary_goal ?? "SAME_BED";
  const hasPartner = answers.has_partner === true;
  const goalLabels = hasPartner ? GOAL_LABELS_WITH_PARTNER : GOAL_LABELS_SOLO;
  const goalText = goalLabels[primaryGoal] ?? goalLabels.REDUCE_FOR_PARTNER ?? goalLabels.SAME_BED ?? "Just track your sleep";
  const role = answers.role === "PARTNER" ? "PARTNER" : "SLEEPER";

  const onboardingPayload = buildOnboardingPayload(answers);

  const finishOnboarding = async () => {
    if (!session) {
      router.replace("/(auth)/sign-up");
      return;
    }
    await completeOnboarding({
      first_name: null,
      role,
      has_partner: hasPartner,
      anonymous_id: anonymousIdRef.current ?? undefined,
      weight_kg: answers.weight_kg ?? undefined,
      height_cm: answers.height_cm ?? undefined,
      onboarding_responses: onboardingPayload,
    });
    router.replace("/(tabs)");
  };

  const handleClose = () => finishOnboarding();

  const navigateToSignUp = () => router.replace("/(auth)/sign-up");

  const handleStartTrial = async () => {
    const pkg = packages.find((p) => p.identifier === selectedPlan) ?? packages[0];

    if (!pkg) {
      __DEV__ && console.warn("[Paywall] No package found, skipping purchase");
      finishOnboarding();
      return;
    }

    setPurchasing(true);
    try {
      const success = await purchase(pkg);
      if (success) {
        alertApi.show({
          icon: { name: "checkmark-circle", color: "#2ECC71", bgColor: "rgba(46, 204, 113, 0.15)" },
          title: "Welcome to QuietNight Pro!",
          message: "Your subscription is active. Create your account to get started.",
          buttons: [{ text: "Create Account", onPress: navigateToSignUp }],
        });
      }
    } catch {
      alertApi.show({
        icon: { name: "close-circle", color: "#E74C3C", bgColor: "rgba(231, 76, 60, 0.15)" },
        title: "Purchase failed",
        message: "Something went wrong with your purchase. Please try again.",
        buttons: [{ text: "Try Again", onPress: () => {} }],
      });
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        alertApi.show({
          icon: { name: "checkmark-circle", color: "#2ECC71", bgColor: "rgba(46, 204, 113, 0.15)" },
          title: "Purchases restored!",
          message: "Your subscription has been restored. Create your account to continue.",
          buttons: [{ text: "Create Account", onPress: navigateToSignUp }],
        });
      } else {
        alertApi.show({
          icon: { name: "information-circle", color: "#3498DB", bgColor: "rgba(52, 152, 219, 0.15)" },
          title: "No purchases found",
          message: "We couldn't find an active subscription for this account.",
          buttons: [{ text: "OK", onPress: () => {} }],
        });
      }
    } catch {
      alertApi.show({
        icon: { name: "close-circle", color: "#E74C3C", bgColor: "rgba(231, 76, 60, 0.15)" },
        title: "Restore failed",
        message: "Something went wrong. Please check your connection and try again.",
        buttons: [{ text: "Try Again", onPress: () => {} }],
      });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <ScreenBackgroundWithContent>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={text.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {goalText && (
            <Text style={styles.goalText}>
              Your goal: {goalText} in {targetWeeks} week{targetWeeks !== 1 ? "s" : ""}
            </Text>
          )}
          <View style={[styles.illustWrap, { marginHorizontal: -spacing.screenPadding }]}>
            <View style={[styles.illustClip, { width: illustWidth, height: illustHeight }]}>
              <CoupleSleeping width={illustWidth} height={illustHeight} />
            </View>
          </View>
          <Text style={styles.brandTitle}>QuietNight</Text>
          <Text style={styles.title}>Start your 7-day free trial</Text>
          {subLoading || plans.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={accent.primary} />
            </View>
          ) : (
            <>
              <View style={styles.planRow}>
                {plans.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.planCard,
                      selectedPlan === p.id && styles.planCardSelected,
                    ]}
                    onPress={() => setSelectedPlan(p.id)}
                    activeOpacity={0.8}
                  >
                    {p.save ? (
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveBadgeText}>{p.save}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.planLabel}>{p.label}</Text>
                    <Text style={styles.planPrice}>{p.price}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.priceNote}>
                Less than a pack of nasal strips
              </Text>
            </>
          )}
          <PrimaryButton
            label="Start Your Free Trial"
            onPress={handleStartTrial}
            loading={purchasing}
          />
          <View style={styles.ghostWrap}>
            <GhostButton label="Restore Purchases" onPress={handleRestore} disabled={purchasing} />
          </View>
          <Text style={styles.terms}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </View>
    </ScreenBackgroundWithContent>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  header: { flexDirection: "row", justifyContent: "flex-end", marginBottom: spacing.sm },
  closeBtn: { padding: spacing.xs },
  scroll: { flex: 1 },
  scrollContent: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingBottom: spacing.xxl,
  },
  goalText: {
    ...type.bodyMd,
    color: accent.primary,
    marginBottom: spacing.sm,
  },
  brandTitle: {
    ...type.displayLg,
    color: text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  title: {
    ...type.displayMd,
    color: text.primary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  illustWrap: { marginBottom: spacing.sm },
  illustClip: { overflow: "hidden" },
  planRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  planCard: {
    flex: 1,
    backgroundColor: background.input,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    minHeight: 80,
  },
  planCardSelected: { borderColor: accent.primary },
  priceNote: {
    ...type.bodySm,
    color: text.secondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  saveBadge: {
    position: "absolute",
    top: -6,
    right: 4,
    backgroundColor: accent.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveBadgeText: { ...type.micro, color: text.onAccent, fontFamily: "Poppins_600SemiBold" },
  planLabel: { ...type.labelSm, color: text.primary },
  planPrice: { ...type.bodySm, color: text.secondary, marginTop: 4 },
  loadingWrap: {
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  ghostWrap: { marginTop: spacing.sm },
  terms: {
    ...type.micro,
    color: text.muted,
    textAlign: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
});
