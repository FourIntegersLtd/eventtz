import { useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { PrimaryButton, GhostButton } from "@/components/ui/buttons";
import { ScreenBackgroundWithContent } from "@/components/ScreenBackground";
import { accent, text, type, spacing } from "@/constants/theme";

const SLIDES = [
  {
    title: "Track your sleep",
    description: "Log bedtime, wake time, and quality so you can spot patterns and improve your rest.",
    icon: "moon-outline" as const,
  },
  {
    title: "Capture snoring",
    description: "Optional audio detection helps you and your partner understand the night.",
    icon: "mic-outline" as const,
  },
  {
    title: "See your journey",
    description: "Insights and trends over time so you can share with your doctor or adjust habits.",
    icon: "trending-up-outline" as const,
  },
];

const ILLUST_SIZE = 240;

export default function OnboardingCarouselScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
      setIndex(index + 1);
    } else {
      router.replace("/(onboarding)/personalization");
    }
  };

  const skip = () => router.replace("/(onboarding)/personalization");

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <ScreenBackgroundWithContent>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.skipWrap}>
          <GhostButton label="Skip" onPress={skip} />
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          onMomentumScrollEnd={onScroll}
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          contentContainerStyle={styles.pagerContent}
        >
          {SLIDES.map((s, i) => (
            <View key={i} style={[styles.slide, { width }]}>
              <View style={styles.illustWrap}>
                <View style={styles.illustCircle}>
                  <Ionicons name={s.icon} size={80} color={accent.primary} />
                </View>
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.slideTitle}>{s.title}</Text>
                <Text style={styles.slideDesc}>{s.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
        <View style={styles.buttonWrap}>
          <PrimaryButton
            label={isLast ? "Continue" : "Next"}
            onPress={goNext}
          />
        </View>
      </View>
    </ScreenBackgroundWithContent>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.screenPadding },
  skipWrap: { alignItems: "flex-end", marginBottom: spacing.sm },
  pager: { flex: 1 },
  pagerContent: {},
  slide: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    justifyContent: "flex-start",
  },
  illustWrap: {
    height: "55%",
    justifyContent: "center",
    alignItems: "center",
  },
  illustCircle: {
    width: ILLUST_SIZE,
    height: ILLUST_SIZE,
    borderRadius: ILLUST_SIZE / 2,
    backgroundColor: "rgba(255,127,63,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1, justifyContent: "center", paddingTop: spacing.md },
  slideTitle: {
    ...type.headingLg,
    color: text.primary,
    marginBottom: spacing.sm,
  },
  slideDesc: {
    ...type.bodyMd,
    color: text.secondary,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: spacing.sm,
  },
  dot: { borderRadius: 9999 },
  dotActive: { width: 8, height: 8, backgroundColor: accent.primary },
  dotInactive: { width: 6, height: 6, backgroundColor: text.muted },
  buttonWrap: { paddingBottom: spacing.lg },
});
