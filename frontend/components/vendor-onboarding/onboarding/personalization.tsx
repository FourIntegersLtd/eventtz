import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { PrimaryButton } from "@/components/ui/buttons";
import { IconSelectorGrid, type IconSelectorItem } from "@/components/IconSelectorGrid";
import { ScreenBackgroundWithContent } from "@/components/ScreenBackground";
import { accent, background, text, type, spacing } from "@/constants/theme";

const CONCERN_OPTIONS: IconSelectorItem[] = [
  { id: "snoring", icon: "mic-outline", label: "Snoring" },
  { id: "insomnia", icon: "moon-outline", label: "Insomnia" },
  { id: "apnea", icon: "bed-outline", label: "Sleep Apnea" },
  { id: "wake", icon: "sunny-outline", label: "Wake often" },
  { id: "schedule", icon: "time-outline", label: "Schedule" },
  { id: "other", icon: "ellipsis-horizontal", label: "Other" },
];

const FREQUENCY_OPTIONS = [
  { id: "rarely", label: "Rarely" },
  { id: "sometimes", label: "Sometimes" },
  { id: "often", label: "Often" },
  { id: "every", label: "Almost every night" },
];

const SEGMENT_COUNT = 3;

export default function OnboardingPersonalizationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [concern, setConcern] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const progress = (step + 1) / SEGMENT_COUNT;

  const handleContinue = () => {
    if (step < SEGMENT_COUNT - 1) {
      setStep(step + 1);
    } else {
      router.replace("/(onboarding)/paywall");
    }
  };

  return (
    <ScreenBackgroundWithContent>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
        </View>

        {step === 0 && (
          <>
            <Text style={styles.question}>
              What best describes your sleep concern?
            </Text>
            <IconSelectorGrid
              items={CONCERN_OPTIONS}
              selectedIds={concern ? [concern] : []}
              onSelect={(id) => setConcern(id)}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.question}>How often do you have poor sleep?</Text>
            <View style={styles.radioList}>
              {FREQUENCY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.radioRow}
                  onPress={() => setFrequency(opt.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      frequency === opt.id && styles.radioOuterSelected,
                    ]}
                  >
                    {frequency === opt.id ? (
                      <View style={styles.radioInner} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.radioLabel,
                      frequency === opt.id && styles.radioLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.question}>Enable sleep audio detection?</Text>
            <Text style={styles.toggleDesc}>
              Optional microphone use to detect snoring or sounds during sleep.
            </Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>
                {audioEnabled ? "On" : "Off"}
              </Text>
              <Switch
                value={audioEnabled}
                onValueChange={setAudioEnabled}
                trackColor={{
                  false: background.input,
                  true: accent.primary,
                }}
                thumbColor="#fff"
                style={styles.switch}
              />
            </View>
          </>
        )}

        <View style={styles.buttonWrap}>
          <PrimaryButton
            label={step < SEGMENT_COUNT - 1 ? "Next" : "Continue"}
            onPress={handleContinue}
          />
        </View>
      </ScrollView>
    </ScreenBackgroundWithContent>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenPadding,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  progressWrap: { marginBottom: spacing.lg },
  progressTrack: {
    height: 4,
    backgroundColor: background.input,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: accent.primary,
    borderRadius: 2,
  },
  question: {
    ...type.headingMd,
    color: text.primary,
    marginBottom: spacing.md,
  },
  radioList: { marginBottom: spacing.lg },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    gap: spacing.sm,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: text.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: { borderColor: accent.primary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: accent.primary,
  },
  radioLabel: { ...type.bodyLg, color: text.primary },
  radioLabelSelected: { fontFamily: "Poppins_500Medium", color: accent.primary },
  toggleDesc: {
    ...type.bodyMd,
    color: text.secondary,
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
  },
  toggleLabel: { ...type.bodyLg, color: text.primary },
  switch: {},
  buttonWrap: { marginTop: spacing.xl },
});
