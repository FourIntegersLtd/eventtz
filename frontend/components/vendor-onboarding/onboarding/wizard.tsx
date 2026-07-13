import { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Animated,
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  FlatList,
  TextInput,
  Platform,
  Share,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { OnboardingAnswers, OnboardingRole, SleepingArrangement, PrimaryGoal } from "@/types/onboarding";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { PrimaryButton, GhostButton } from "@/components/ui/buttons";
import { IconSelectorGrid, type IconSelectorItem } from "@/components/IconSelectorGrid";
import { ScreenBackgroundWithContent } from "@/components/ScreenBackground";
import { AnimatedStepItem } from "@/components/AnimatedStep";
import PhoneOnDesk from "@/assets/images/vectors/phone-on-desk.svg";
import Couple from "@/assets/images/vectors/couple.svg";
import PersonSuccess from "@/assets/images/vectors/person-success.svg";
import Graph from "@/assets/images/vectors/graph.svg";
import Svg, { Path } from "react-native-svg";
import { accent, background, text, type, spacing, radius, semantic, fonts } from "@/constants/theme";
import { getPartnerCheckInUrl, PARTNER_CHECKIN_SHARE_MESSAGE } from "@/lib/partner-checkin";
import { getTodayNightKey } from "@/lib/nights";

// Step 5 options
const ATTRIBUTION_OPTIONS: IconSelectorItem[] = [
  { id: "APP_STORE_SEARCH", icon: "search-outline", label: "App Store Search" },
  { id: "TIKTOK_INSTAGRAM", icon: "logo-tiktok", label: "TikTok/Instagram" },
  { id: "FRIEND", icon: "people-outline", label: "A friend" },
  { id: "DOCTOR", icon: "medkit-outline", label: "My doctor" },
  { id: "YOUTUBE", icon: "logo-youtube", label: "YouTube" },
  { id: "OTHER", icon: "ellipsis-horizontal", label: "Other" },
];

// Step 6 options
const PRIOR_APP_OPTIONS = [
  { id: "YES_DIDNT_HELP", label: "Yes but they didn't help" },
  { id: "YES_OKAY", label: "Yes and they were okay" },
  { id: "NO_FIRST", label: "No, this is my first one" },
];

const COMPASSIONATE_STEP = 9.5;
const ILLUST_SIZE = 180;

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.progressWrap}>
      <Text style={styles.progressText}>
        Step {current} of {total}
      </Text>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${(current / total) * 100}%` }]}
        />
      </View>
    </View>
  );
}

export default function OnboardingWizardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { step, answers, visibleStepIndex, totalSteps, setAnswer, goNext, goBack } =
    useOnboarding();

  // Redirect to welcome if step 1 (shouldn't happen, but guard)
  if (step === 1) {
    router.replace("/(onboarding)/welcome");
    return null;
  }

  const isLastStep =
    (step === 24 && answers.has_partner !== true) ||
    step === 27;

  const handleNext = () => {
    if (isLastStep) {
      router.replace("/(onboarding)/paywall");
    } else {
      goNext();
    }
  };

  const canGoBack = step > 2;

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
        {step === 2 && (
          <View style={styles.skipRow}>
            <TouchableOpacity
              onPress={() => router.replace("/(onboarding)/paywall")}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.headerRow}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={goBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={text.secondary} />
            </TouchableOpacity>
          )}
          <View style={styles.progressArea}>
            <ProgressBar current={visibleStepIndex} total={totalSteps} />
          </View>
        </View>

        <View key={step}>
          {/* Phase A: Steps 2–7 */}
          {step === 2 && (
            <Step2UserName
              value={answers.user_name ?? ""}
              onChange={(v) => setAnswer("user_name", v)}
              onContinue={handleNext}
            />
          )}
          {step === 3 && <Step3Welcome answers={answers} />}
          {step === 4 && (
            <Step4HasPartner
              value={answers.has_partner}
              onSelect={(v) => setAnswer("has_partner", v)}
            />
          )}
          {step === 5 && (
            <Step5PartnerName
              partnerName={answers.partner_name ?? ""}
              onPartnerNameChange={(v) => setAnswer("partner_name", v)}
            />
          )}
          {step === 6 && <Step3TwoPlayer answers={answers} />}
          {step === 7 && (
            <Step5Attribution
              value={answers.attribution_source}
              onSelect={(v) => setAnswer("attribution_source", v)}
            />
          )}
          {step === 8 && (
            <Step6PriorApps
              value={answers.prior_app_usage}
              onSelect={(v) => setAnswer("prior_app_usage", v)}
            />
          )}

          {/* Phase B: Steps 9–17 */}
          {step === 9 && (
            <Step7WhoAreYou
              answers={answers}
              value={answers.role}
              onSelect={(v) => setAnswer("role", v as OnboardingRole)}
            />
          )}
          {step === 10 && (
            <Step8LivingSituation
              answers={answers}
              value={answers.sleeping_arrangement}
              onSelect={(v) => setAnswer("sleeping_arrangement", v as SleepingArrangement)}
            />
          )}
          {step === 11 && (
            <Step9Severity
              value={answers.relationship_severity}
              onSelect={(v) => setAnswer("relationship_severity", v)}
            />
          )}
          {step === COMPASSIONATE_STEP && <Step9bCompassionate />}
          {step === 12 && (
            <Step10Duration
              value={answers.problem_duration}
              onSelect={(v) => setAnswer("problem_duration", v)}
            />
          )}
          {step === 13 && (
            <Step11Remedies
              answers={answers}
              value={answers.remedies_tried}
              onSelect={(v) => setAnswer("remedies_tried", v)}
            />
          )}
          {step === 14 && <Step12Validation answers={answers} />}
          {step === 15 && (
            <Step13Goal
              answers={answers}
              value={answers.primary_goal}
              onSelect={(v) => setAnswer("primary_goal", v as PrimaryGoal)}
            />
          )}
          {step === 16 && (
            <Step14Target
              answers={answers}
              value={answers.target_weeks ?? 4}
              onSelect={(v) => setAnswer("target_weeks", v)}
            />
          )}
          {step === 17 && <Step15Affirmation answers={answers} />}

          {/* Phase C: Steps 18–22 */}
          {step === 18 && <Step16Experiments answers={answers} />}
          {step === 19 && <Step17Honesty />}
          {step === 20 && <Step18Privacy answers={answers} />}
          {step === 21 && <Step19Medical />}
          {step === 22 && <Step20Generating answers={answers} onComplete={goNext} />}

          {/* Phase D: Steps 23–27 */}
          {step === 23 && <Step21PlanPreview answers={answers} />}
          {step === 24 && <Step22Notifications />}
          {step === 25 && <Step23Health />}
          {step === 26 && <Step24PartnerInvite answers={answers} />}
          {step === 27 && <Step25Rate answers={answers} />}
        </View>

        {step !== 22 && step !== 2 && (
          <View style={styles.buttonWrap}>
            <PrimaryButton
              label={isLastStep ? "Start Free Trial" : "Continue"}
              onPress={handleNext}
            />
          </View>
        )}
      </ScrollView>
    </ScreenBackgroundWithContent>
  );
}

// ─── Phase A ────────────────────────────────────────────────────────────────

function Step2UserName({
  value,
  onChange,
  onContinue,
}: {
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.welcomeLead}>Let&apos;s get started</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.headline}>What would you like us to call you?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <Text style={styles.subtext}>
          This is the name we&apos;ll use in your plan and check-ins. We only use it for personalisation—we never share it.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <View style={styles.nameInputWrap}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="e.g. Mike"
            placeholderTextColor={text.muted}
            autoFocus={Platform.OS === "ios"}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={onContinue}
            editable
            style={styles.nameInput}
          />
        </View>
      </AnimatedStepItem>
      <View style={styles.buttonWrap}>
        <PrimaryButton label="Continue" onPress={onContinue} />
      </View>
    </>
  );
}

function Step5PartnerName({
  partnerName,
  onPartnerNameChange,
}: {
  partnerName: string;
  onPartnerNameChange: (v: string) => void;
}) {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>What&apos;s your partner&apos;s name?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          We&apos;ll use it to personalise their experience when they join. We never share it.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.nameInputWrap}>
          <TextInput
            value={partnerName}
            onChangeText={onPartnerNameChange}
            placeholder="e.g. Sarah"
            placeholderTextColor={text.muted}
            autoCapitalize="words"
            returnKeyType="done"
            style={styles.nameInput}
          />
        </View>
      </AnimatedStepItem>
    </>
  );
}

function Step3Welcome({ answers }: { answers: OnboardingAnswers }) {
  const { width: windowWidth } = useWindowDimensions();
  const name = (answers.user_name ?? "").trim();
  const displayName = name || "there";
  return (
    <>
      <AnimatedStepItem index={0}>
        <View style={styles.illustWrapFullBleed}>
          <PhoneOnDesk width={windowWidth} height={Math.round(windowWidth * (1684 / 2384))} />
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.headline}>Welcome to QuietNight{name ? `, ${name}` : ""}.</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <Text style={styles.subtext}>
          We help you track snoring overnight with just your phone — no wearables. In the morning you see a clear summary so you can test what actually works instead of guessing.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

const COUPLE_ASPECT = 2250 / 3750;

function Step3TwoPlayer({ answers }: { answers: OnboardingAnswers }) {
  const { width: windowWidth } = useWindowDimensions();
  const isSolo = answers.sleeping_arrangement === "SLEEP_ALONE";
  const partnerName = (answers.partner_name ?? "").trim();
  const partnerLabel = partnerName || "Your partner";
  return (
    <>
      <AnimatedStepItem index={0}>
        <View style={styles.illustWrapFullBleed}>
          <Couple width={windowWidth} height={Math.round(windowWidth * COUPLE_ASPECT)} />
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.headline}>Built for two.</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <Text style={styles.subtext}>
          {isSolo
            ? "When you have a partner, QuietNight records your sleep overnight and they rate their sleep each morning. We combine both so you're not just tracking snoring — you're fixing it together."
            : `QuietNight records your sleep overnight. ${partnerLabel} rates their sleep each morning. We then combine both — your night data and their real experience — so you're not just tracking snoring, you're fixing it together.`}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          No other snoring app puts the couple at the centre like this.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

function Step5Attribution({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (v: string) => void;
}) {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>How did you find QuietNight?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          Quick question — it helps us reach more couples like you.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <IconSelectorGrid
          items={ATTRIBUTION_OPTIONS}
          selectedIds={value ? [value] : []}
          onSelect={onSelect}
        />
      </AnimatedStepItem>
    </>
  );
}

function Step6PriorApps({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (v: string) => void;
}) {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>Have you tried other snoring apps before?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          No judgement — we're just curious. Your answer helps us personalise your experience.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.radioList}>
          {PRIOR_APP_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.radioRow}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioOuter,
                  value === opt.id && styles.radioOuterSelected,
                ]}
              >
                {value === opt.id ? <View style={styles.radioInner} /> : null}
              </View>
              <Text
                style={[styles.radioLabel, value === opt.id && styles.radioLabelSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStepItem>
    </>
  );
}

const HAS_PARTNER_OPTIONS = [
  { id: true, label: "Yes, I have a partner" },
  { id: false, label: "No, just me" },
];

function Step4HasPartner({
  value,
  onSelect,
}: {
  value?: boolean;
  onSelect: (v: boolean) => void;
}) {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>Do you have a partner?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          QuietNight works great on your own. If you have a partner, they can join later to add morning ratings — but it's totally optional.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.pillList}>
          {HAS_PARTNER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={String(opt.id)}
              style={[styles.pill, value === opt.id && styles.pillSelected]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillLabel, value === opt.id && styles.pillLabelSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStepItem>
    </>
  );
}

// ─── Phase B ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS_PARTNER = [
  { id: "SLEEPER", label: "I'm the snorer" },
  { id: "PARTNER", label: "I'm the partner who can't sleep" },
  { id: "UNSURE", label: "We're not sure who snores" },
];

const ROLE_OPTIONS_SOLO = [
  { id: "SLEEPER", label: "I'm the one who snores" },
  { id: "UNSURE", label: "I'm not sure / I just want to track" },
];

function Step7WhoAreYou({
  answers,
  value,
  onSelect,
}: {
  answers: OnboardingAnswers;
  value?: string;
  onSelect: (v: string) => void;
}) {
  const hasPartner = answers.has_partner === true;
  const options = hasPartner ? ROLE_OPTIONS_PARTNER : ROLE_OPTIONS_SOLO;
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>
          {hasPartner ? "Which best describes you?" : "Are you the one who snores?"}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          {hasPartner
            ? "Whether you're the one who snores or the one who can't sleep — we've got you. Your answer shapes how we talk to you and what we recommend."
            : "Your answer helps us tailor your plan and how we talk to you. No wrong answer — we're here to help you find what works."}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.pillList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.pill, value === opt.id && styles.pillSelected]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillLabel, value === opt.id && styles.pillLabelSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStepItem>
    </>
  );
}

const ARRANGEMENT_OPTIONS = [
  { id: "SAME_BED_ROOM", label: "Same bed, same room" },
  { id: "SAME_ROOM_BEDS", label: "Same room, separate beds" },
  { id: "SEPARATE_ROOMS", label: "Separate rooms" },
  { id: "SLEEP_ALONE", label: "I sleep alone (no partner)" },
];

function Step8LivingSituation({
  answers,
  value,
  onSelect,
}: {
  answers: OnboardingAnswers;
  value?: string;
  onSelect: (v: string) => void;
}) {
  const partnerName = (answers.partner_name ?? "").trim();
  const partnerLabel = partnerName || "your partner";
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>Where do you and {partnerLabel} currently sleep?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          This helps us frame your goal. Same bed, separate beds, or separate rooms — we'll tailor your plan and milestones to where you are now.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.pillList}>
          {ARRANGEMENT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.pill, value === opt.id && styles.pillSelected]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillLabel, value === opt.id && styles.pillLabelSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStepItem>
    </>
  );
}

const SEVERITY_OPTIONS: {
  value: 1 | 2 | 3 | 4 | 5;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { value: 1, icon: "happy-outline", label: "It's mild — just annoying" },
  { value: 2, icon: "alert-circle-outline", label: "It's a regular problem" },
  { value: 3, icon: "sad-outline", label: "It's causing real tension" },
  { value: 4, icon: "heart-dislike-outline", label: "It's seriously hurting us" },
  { value: 5, icon: "heart-dislike", label: "We're at breaking point — I'm at my wits' end" },
];

function Step9Severity({
  value,
  onSelect,
}: {
  value?: 1 | 2 | 3 | 4 | 5;
  onSelect: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>How much does snoring affect your relationship?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          Be honest — this isn't for anyone else. It helps us personalise your plan.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.severityCardList}>
          {SEVERITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.severityCard, value === opt.value && styles.severityCardSelected]}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.7}
            >
              <View style={styles.severityCardIconWrap}>
                <Ionicons
                  name={opt.icon}
                  size={28}
                  color={value === opt.value ? accent.primary : text.secondary}
                />
              </View>
              <Text style={[styles.severityCardLabel, value === opt.value && styles.severityCardLabelSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStepItem>
    </>
  );
}

function Step9bCompassionate() {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>We hear you.</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          Many couples feel the same way. Snoring can put a real strain on a relationship — but you're already taking a positive step by being here.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <Text style={styles.supporting}>
          QuietNight is designed to help you find what works, one experiment at a time. No blame, no guilt — just data and a clear path forward.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

const DURATION_OPTIONS = [
  { id: "LESS_6M", label: "Less than 6 months" },
  { id: "6M_1Y", label: "6 months – 1 year" },
  { id: "1_3Y", label: "1–3 years" },
  { id: "MORE_3Y", label: "More than 3 years" },
];

function Step10Duration({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (v: string) => void;
}) {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>How long has snoring been a problem?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          Whether it's been months or years, we'll use this to personalise your plan and set realistic expectations. The longer it's been, the more we'll celebrate the wins.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.pillList}>
          {DURATION_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.pill, value === opt.id && styles.pillSelected]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillLabel, value === opt.id && styles.pillLabelSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStepItem>
    </>
  );
}

const REMEDY_OPTIONS: IconSelectorItem[] = [
  { id: "nasal_strips", icon: "bandage-outline", label: "Nasal strips" },
  { id: "mouth_tape", icon: "mic-off-outline", label: "Mouth tape" },
  { id: "pillow", icon: "bed-outline", label: "Anti-snore pillow" },
  { id: "side_sleeping", icon: "body-outline", label: "Side sleeping" },
  { id: "alcohol", icon: "wine-outline", label: "Cutting alcohol" },
  { id: "mandibular", icon: "medkit-outline", label: "Mandibular device" },
  { id: "surgery", icon: "medical-outline", label: "Surgery" },
  { id: "nothing", icon: "close-circle-outline", label: "Nothing yet" },
];

function Step11Remedies({
  answers,
  value,
  onSelect,
}: {
  answers: OnboardingAnswers;
  value?: string[];
  onSelect: (v: string[]) => void;
}) {
  const isPartner = answers.role === "PARTNER";
  const partnerName = (answers.partner_name ?? "").trim();
  const headline = isPartner
    ? (partnerName ? `What has ${partnerName} tried?` : "What has your partner tried?")
    : "Have you tried any of these before?";
  const selected = value ?? [];

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onSelect(selected.filter((x) => x !== id));
    } else {
      onSelect([...selected, id]);
    }
  };

  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>{headline}</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          {isPartner
            ? "Knowing what they've already tried helps us suggest the next experiment — and avoid repeating what didn't work."
            : "Select everything you've tried. We'll use this to recommend your next experiment and avoid repeating what didn't work. No shame — most people try a few things before finding the one."}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <IconSelectorGrid
          items={REMEDY_OPTIONS}
          selectedIds={selected}
          onSelect={(id) => toggle(id)}
        />
      </AnimatedStepItem>
    </>
  );
}

const PERSON_SUCCESS_ASPECT = 2000 / 2400;

function Step12Validation({ answers }: { answers: OnboardingAnswers }) {
  const { width: windowWidth } = useWindowDimensions();
  const hasPartner = answers.has_partner === true;
  const partnerName = (answers.partner_name ?? "").trim();
  const partnerLabel = partnerName || "your partner";
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>You're in the right place.</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          {hasPartner
            ? `Most people try 3–4 remedies before finding what works. The difference with QuietNight? We remove the guesswork by testing each one with real data from both you and ${partnerLabel}.`
            : "Most people try 3–4 remedies before finding what works. The difference with QuietNight? We remove the guesswork by testing each one with real data — so you can see what actually works instead of guessing."}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.illustWrapFullBleed}>
          <PersonSuccess
            width={windowWidth}
            height={Math.round(windowWidth * PERSON_SUCCESS_ASPECT)}
          />
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          Let's build your plan around what you've already tried — and what's left to test.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

const GOAL_OPTIONS_PARTNER = [
  { id: "SAME_BED", label: "Get back to same bed" },
  { id: "REDUCE_FOR_PARTNER", label: "Reduce snoring for partner" },
  { id: "SEE_DOCTOR", label: "See a doctor" },
  { id: "JUST_TRACK", label: "Just track" },
];

const GOAL_OPTIONS_SOLO = [
  { id: "REDUCE_FOR_PARTNER", label: "Reduce my snoring" },
  { id: "SEE_DOCTOR", label: "See a doctor" },
  { id: "JUST_TRACK", label: "Just track" },
];

function Step13Goal({
  answers,
  value,
  onSelect,
}: {
  answers: OnboardingAnswers;
  value?: string;
  onSelect: (v: string) => void;
}) {
  const hasPartner = answers.has_partner === true;
  const options = hasPartner ? GOAL_OPTIONS_PARTNER : GOAL_OPTIONS_SOLO;
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>What's your ultimate goal?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          {hasPartner
            ? (() => {
                const pn = (answers.partner_name ?? "").trim();
                const checkInsLabel = pn ? `${pn}'s check-ins` : "your partner's check-ins";
                return `We'll use this to shape your milestones and morning summaries. Everything in the app — from your Journey tab to ${checkInsLabel} — will point toward this.`;
              })()
            : "We'll use this to shape your milestones and morning summaries. Everything in the app — from your Journey tab to your first experiment — will point toward this."}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.pillList}>
          {(hasPartner && (answers.partner_name ?? "").trim()
            ? options.map((opt) =>
                opt.id === "REDUCE_FOR_PARTNER"
                  ? { ...opt, label: `Reduce snoring for ${(answers.partner_name ?? "").trim()}` }
                  : opt,
              )
            : options
          ).map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.pill, value === opt.id && styles.pillSelected]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillLabel, value === opt.id && styles.pillLabelSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStepItem>
    </>
  );
}

function Step14Target({
  answers,
  value,
  onSelect,
}: {
  answers: OnboardingAnswers;
  value: number;
  onSelect: (v: number) => void;
}) {
  const hasPartner = answers.has_partner === true;
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>In how many weeks would you like to find a solution?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          {hasPartner
            ? "Most couples see a clear winner within 2–3 weeks of experimenting. Setting a target keeps you on track and lets us nudge you at the right time."
            : "Most people see a clear winner within 2–3 weeks of experimenting. Setting a target keeps you on track and lets us nudge you at the right time."}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.weekBtn, value === n && styles.weekBtnSelected]}
              onPress={() => onSelect(n)}
              activeOpacity={0.7}
            >
              <Text style={[styles.weekLabel, value === n && styles.weekLabelSelected]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>Your target: {value} week{value !== 1 ? "s" : ""}</Text>
      </AnimatedStepItem>
    </>
  );
}

const GRAPH_ASPECT = 3303.7 / 2761.4;

function Step15Affirmation({ answers }: { answers: OnboardingAnswers }) {
  const { width: windowWidth } = useWindowDimensions();
  const weeks = (answers.target_weeks ?? 4) as number;
  const hasPartner = answers.has_partner === true;
  const name = (answers.user_name ?? "").trim();
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>
          You've got great potential{name ? `, ${name}` : ""}.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          {hasPartner
            ? `Based on couples like you — same situation, same goals — snoring can be significantly reduced within ${weeks} weeks using structured experiments. The first few nights build your baseline; after that, the data gets smarter every night.`
            : `Based on people like you — same situation, same goals — snoring can be significantly reduced within ${weeks} weeks using structured experiments. The first few nights build your baseline; after that, the data gets smarter every night.`}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.illustWrapFullBleed}>
          <Graph
            width={windowWidth}
            height={Math.round(windowWidth * GRAPH_ASPECT * 0.55)}
          />
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          {hasPartner
            ? "You're not just tracking. You're testing, learning, and moving toward a quieter night — together."
            : "You're not just tracking. You're testing, learning, and moving toward a quieter night."}
        </Text>
      </AnimatedStepItem>
    </>
  );
}

// ─── Phase C ────────────────────────────────────────────────────────────────

const STEP16_PANELS_PARTNER = [
  {
    icon: "checkmark-circle-outline" as const,
    title: "Pick a remedy to test tonight",
    desc: "e.g. mouth tape, nasal strip, side sleeping",
  },
  {
    icon: "analytics-outline" as const,
    title: "QuietNight tracks your night",
    desc: "Snoring detection runs on your phone",
  },
  {
    icon: "star-outline" as const,
    title: "Partner rates their sleep",
    desc: "Morning check-in: good night or rough?",
  },
];

const STEP16_PANELS_SOLO = [
  {
    icon: "checkmark-circle-outline" as const,
    title: "Pick a remedy to test tonight",
    desc: "e.g. mouth tape, nasal strip, side sleeping",
  },
  {
    icon: "analytics-outline" as const,
    title: "QuietNight tracks your night",
    desc: "Snoring detection runs on your phone",
  },
  {
    icon: "sunny-outline" as const,
    title: "Morning summary",
    desc: "See what worked and what didn't",
  },
];

function Step16ExperimentPanel({
  icon,
  title,
  desc,
  opacity,
  pageWidth,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  opacity: Animated.Value;
  pageWidth: number;
}) {
  return (
    <View style={[styles.step16PageWrap, { width: pageWidth }]}>
      <Animated.View style={[styles.step16Page, { opacity }]}>
        <View style={styles.step16Card}>
          <Ionicons name={icon} size={56} color={accent.primary} />
          <Text style={styles.step16PanelTitle}>{title}</Text>
          <Text style={styles.step16PanelDesc}>{desc}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const STEP16_AUTO_ADVANCE_MS = 3500;

function Step16Experiments({ answers }: { answers: OnboardingAnswers }) {
  const hasPartner = answers.has_partner === true;
  const partnerName = (answers.partner_name ?? "").trim();
  const panels = hasPartner
    ? STEP16_PANELS_PARTNER.map((p) =>
        p.title === "Partner rates their sleep" && partnerName
          ? { ...p, title: `${partnerName} rates their sleep` }
          : p,
      )
    : STEP16_PANELS_SOLO;
  const { width } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);
  const pageIndexRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const opacityAnims = useRef(panels.map(() => new Animated.Value(1))).current;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i >= 0 && i < panels.length) {
      pageIndexRef.current = i;
      setPageIndex(i);
    }
  };

  useEffect(() => {
    opacityAnims.forEach((anim, idx) => {
      anim.setValue(0);
    });
    Animated.timing(opacityAnims[pageIndex], {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [pageIndex]);

  useEffect(() => {
    const id = setInterval(() => {
      const next = (pageIndexRef.current + 1) % panels.length;
      pageIndexRef.current = next;
      setPageIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, STEP16_AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [width]);

  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>How QuietNight experiments work</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          {pageIndex === 0 && "It's a simple loop. Swipe or wait to see each step."}
          {pageIndex === 1 && "We measure the night on your phone."}
          {pageIndex === 2 && (hasPartner ? (partnerName ? `${partnerName}'s rating completes the picture.` : "Your partner's rating completes the picture.") : "Your morning summary completes the picture.")}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          onMomentumScrollEnd={onScroll}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={styles.step16Scroll}
          contentContainerStyle={styles.step16ScrollContent}
        >
          {panels.map((panel, i) => (
            <Step16ExperimentPanel
              key={i}
              icon={panel.icon}
              title={panel.title}
              desc={panel.desc}
              opacity={opacityAnims[i]}
              pageWidth={width}
            />
          ))}
        </ScrollView>
        <View style={styles.step16Dots}>
          {panels.map((_, i) => (
            <View
              key={i}
              style={[
                styles.step16Dot,
                i === pageIndex ? styles.step16DotActive : styles.step16DotInactive,
              ]}
            />
          ))}
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          After a few nights, the app tells you exactly what's working — no guesswork.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

function Step17Honesty() {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>The first few nights are about learning you.</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          Like any good experiment, we need a baseline first. The real insights — "Snoring down 40% with mouth tape" — start after Night 3. Stick with it: the data gets smarter every night.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <Text style={styles.supporting}>
          We're honest about this so you know what to expect. No hype — just a clear timeline and real results once the data is in.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

function Step18Privacy({ answers }: { answers: OnboardingAnswers }) {
  const hasPartner = answers.has_partner === true;
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>Your audio never leaves your phone.</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          We know bedroom audio is sensitive. Here's exactly how we handle it.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• All snoring detection happens on-device using AI — no raw audio is ever sent to our servers.</Text>
          <Text style={styles.bullet}>• We never upload your bedroom audio to the cloud.</Text>
          <Text style={styles.bullet}>
            {hasPartner
              ? (() => {
                  const pn = (answers.partner_name ?? "").trim();
                  const dashLabel = pn ? `${pn}'s dashboard` : "your partner's dashboard";
                  return `• Only anonymous metadata (e.g. "snoring reduced by 30%") is synced for ${dashLabel} and your own insights.`;
                })()
              : '• Only anonymous metadata (e.g. "snoring reduced by 30%") is used for your insights — nothing leaves your phone.'}
          </Text>
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          You stay in control. Your data stays on your device.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

function Step19Medical() {
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>QuietNight is a wellness tool, not a medical device.</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          We help you test remedies and understand your snoring patterns. If our data ever suggests something more serious — like possible sleep apnea — we'll guide you to speak with your GP. We can even generate a report to bring to your appointment.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <Text style={styles.supporting}>
          This keeps you safe and us honest. We're here to support your journey, not replace your doctor.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

const GENERATING_PHRASES_WITH_PARTNER = [
  "Analyzing your profile...",
  "Building your plan...",
  "Personalizing milestones...",
  "Preparing partner invite...",
  "Your plan is ready!",
];

const GENERATING_PHRASES_SOLO = [
  "Analyzing your profile...",
  "Building your plan...",
  "Personalizing milestones...",
  "Your plan is ready!",
];

const BUILDING_PLAN_DURATION_MS = 32000;

const CIRCULAR_SIZE = 180;
const CIRCULAR_STROKE = 12;
const CIRCULAR_R = (CIRCULAR_SIZE - CIRCULAR_STROKE) / 2;
const CIRCULAR_CIRCUMFERENCE = 2 * Math.PI * CIRCULAR_R;

const RING_COLORS = ["#7C6AFF", "#E040FB", "#00E5FF"];

function CircularProgress() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / BUILDING_PLAN_DURATION_MS) * 100);
      setPercent(p);
    }, 50);
    return () => clearInterval(id);
  }, []);

  const cx = CIRCULAR_SIZE / 2;
  const cy = CIRCULAR_SIZE / 2;
  const fraction = percent / 100;
  const totalArc = fraction * CIRCULAR_CIRCUMFERENCE;

  const segmentArcs = RING_COLORS.map((color, i) => {
    const segStart = i / RING_COLORS.length;
    const segEnd = (i + 1) / RING_COLORS.length;
    if (fraction <= segStart) return null;
    const clampedEnd = Math.min(fraction, segEnd);
    const arcLen = (clampedEnd - segStart) * CIRCULAR_CIRCUMFERENCE;
    const offset = CIRCULAR_CIRCUMFERENCE - segStart * CIRCULAR_CIRCUMFERENCE;
    return { color, arcLen, offset };
  });

  return (
    <View style={styles.circularProgressWrap}>
      <View style={styles.circularProgressSvgRotate}>
        <Svg width={CIRCULAR_SIZE} height={CIRCULAR_SIZE}>
          <Path
            d={`M ${cx} ${CIRCULAR_STROKE / 2} A ${CIRCULAR_R} ${CIRCULAR_R} 0 1 1 ${cx - 0.01} ${CIRCULAR_STROKE / 2}`}
            stroke={background.input}
            strokeWidth={CIRCULAR_STROKE}
            fill="none"
          />
          {segmentArcs.map((seg, i) =>
            seg ? (
              <Path
                key={i}
                d={`M ${cx} ${CIRCULAR_STROKE / 2} A ${CIRCULAR_R} ${CIRCULAR_R} 0 1 1 ${cx - 0.01} ${CIRCULAR_STROKE / 2}`}
                stroke={seg.color}
                strokeWidth={CIRCULAR_STROKE}
                strokeDasharray={`${seg.arcLen} ${CIRCULAR_CIRCUMFERENCE - seg.arcLen}`}
                strokeDashoffset={seg.offset}
                strokeLinecap="round"
                fill="none"
              />
            ) : null,
          )}
        </Svg>
      </View>
      <View style={styles.circularProgressCenter}>
        <Text style={styles.circularProgressPercent}>{Math.round(percent)}%</Text>
        <Text style={styles.circularProgressLabel}>Complete</Text>
      </View>
    </View>
  );
}

function Step20Generating({ answers, onComplete }: { answers: OnboardingAnswers; onComplete: () => void }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const hasPartner = answers.has_partner === true;
  const phrases = hasPartner ? GENERATING_PHRASES_WITH_PARTNER : GENERATING_PHRASES_SOLO;

  useEffect(() => {
    const phraseInterval = setInterval(() => {
      setPhraseIndex((i) => (i < phrases.length - 1 ? i + 1 : i));
    }, BUILDING_PLAN_DURATION_MS / phrases.length);
    return () => clearInterval(phraseInterval);
  }, [phrases.length]);

  useEffect(() => {
    const t = setTimeout(() => onComplete(), BUILDING_PLAN_DURATION_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>Building your plan...</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <CircularProgress />
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <Text style={styles.generatingPhrase}>{phrases[phraseIndex]}</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          {(() => {
            const name = (answers.user_name ?? "").trim();
            const namePart = name ? `, ${name}` : "";
            const pn = (answers.partner_name ?? "").trim();
            if (answers.has_partner)
              return pn
                ? `We're turning everything you told us into a personalised experiment plan and milestones — just for you and ${pn}${namePart}.`
                : `We're turning everything you told us into a personalised experiment plan and milestones — just for you and your partner${namePart}.`;
            return `We're turning everything you told us into a personalised experiment plan and milestones — just for you${namePart}.`;
          })()}
        </Text>
      </AnimatedStepItem>
    </>
  );
}

// ─── Phase D ────────────────────────────────────────────────────────────────

const JOURNEY_PIE_SIZE = 160;
const JOURNEY_PIE_R = JOURNEY_PIE_SIZE / 2;

const JOURNEY_SEGMENTS = [
  { label: "Baseline", color: "#7C6AFF" },
  { label: "Experiments", color: "#E040FB" },
  { label: "Your breakthrough", color: "#00E5FF" },
] as const;

const PIE_SEGMENT_DURATION_MS = 400;
const PIE_SEGMENT_STAGGER_MS = 120;

function JourneyPieChart() {
  const cx = JOURNEY_PIE_R;
  const cy = JOURNEY_PIE_R;
  const r = JOURNEY_PIE_R - 4;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x = (deg: number) => cx + r * Math.cos(toRad(deg));
  const y = (deg: number) => cy + r * Math.sin(toRad(deg));
  const segments = [
    { start: 0, end: 120 },
    { start: 120, end: 240 },
    { start: 240, end: 360 },
  ];
  const pathD = (start: number, end: number) => {
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x(start)} ${y(start)} A ${r} ${r} 0 ${largeArc} 1 ${x(end)} ${y(end)} Z`;
  };

  const opacities = useRef(segments.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const animations = segments.map((_, i) =>
      Animated.timing(opacities[i], {
        toValue: 1,
        duration: PIE_SEGMENT_DURATION_MS,
        delay: i * PIE_SEGMENT_STAGGER_MS,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    );
    Animated.parallel(animations).start();
  }, []);

  return (
    <View style={styles.journeyChartWrap}>
      <View style={styles.journeyPieContainer}>
        {segments.map((seg, i) => (
          <Animated.View
            key={i}
            style={[styles.journeyPieSegmentWrap, { opacity: opacities[i] }]}
            pointerEvents="none"
          >
            <Svg width={JOURNEY_PIE_SIZE} height={JOURNEY_PIE_SIZE} viewBox={`0 0 ${JOURNEY_PIE_SIZE} ${JOURNEY_PIE_SIZE}`}>
              <Path
                d={pathD(seg.start, seg.end)}
                fill={JOURNEY_SEGMENTS[i].color}
                stroke={background.primary}
                strokeWidth={3}
              />
            </Svg>
          </Animated.View>
        ))}
      </View>
      <View style={styles.journeyLegend}>
        {JOURNEY_SEGMENTS.map((seg, i) => (
          <View key={i} style={styles.journeyLegendRow}>
            <View style={[styles.journeyLegendSwatch, { backgroundColor: seg.color }]} />
            <Text style={styles.journeyLegendLabel}>{seg.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Step21PlanPreview({ answers }: { answers: OnboardingAnswers }) {
  const name = (answers.user_name ?? "").trim();
  const hasPartner = answers.has_partner === true;
  const partnerName = (answers.partner_name ?? "").trim();
  const weeks = answers.target_weeks ?? 4;
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>
          Here's your plan{name ? `, ${name}` : ""}.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <View style={styles.journeyChartSection}>
          <JourneyPieChart />
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.planValueList}>
          <View style={styles.planValueRow}>
            <Ionicons name="analytics-outline" size={20} color="#7C6AFF" />
            <Text style={styles.planValueText}>
              Nightly snoring detection with detailed morning summaries
            </Text>
          </View>
          <View style={styles.planValueRow}>
            <Ionicons name="flask-outline" size={20} color="#E040FB" />
            <Text style={styles.planValueText}>
              Structured remedy experiments — test what actually works, not guess
            </Text>
          </View>
          {hasPartner && (
            <View style={styles.planValueRow}>
              <Ionicons name="people-outline" size={20} color="#E040FB" />
              <Text style={styles.planValueText}>
                {partnerName ? `${partnerName}'s morning ratings combined with your data` : "Your partner's morning ratings combined with your data"}
              </Text>
            </View>
          )}
          <View style={styles.planValueRow}>
            <Ionicons name="trending-up-outline" size={20} color="#00E5FF" />
            <Text style={styles.planValueText}>
              Personalised plans with milestones to track your progress
            </Text>
          </View>
          <View style={styles.planValueRow}>
            <Ionicons name="document-text-outline" size={20} color="#00E5FF" />
            <Text style={styles.planValueText}>
              Exportable reports you can share with your doctor
            </Text>
          </View>
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          All of this is included in your free trial — cancel anytime.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

const BEDTIME_OPTIONS: string[] = [];
for (let h = 19; h <= 23; h++) {
  BEDTIME_OPTIONS.push(`${h.toString().padStart(2, "0")}:00`, `${h.toString().padStart(2, "0")}:30`);
}
BEDTIME_OPTIONS.push("00:00", "00:30");

function formatTimeLabel(value: string): string {
  const [hStr, mStr] = value.split(":");
  const h = parseInt(hStr ?? "21", 10);
  const m = parseInt(mStr ?? "0", 10);
  if (h === 0) return `12:${m.toString().padStart(2, "0")} AM`;
  if (h < 12) return `${h}:${m.toString().padStart(2, "0")} AM`;
  if (h === 12) return `12:${m.toString().padStart(2, "0")} PM`;
  return `${h - 12}:${m.toString().padStart(2, "0")} PM`;
}

function Step22Notifications() {
  const { answers, setAnswer } = useOnboarding();
  const [pickerVisible, setPickerVisible] = useState(false);

  const bedtime = answers.bedtime_reminder_time ?? "21:00";

  const openPicker = () => {
    setPickerVisible(true);
  };

  const onSelectTime = (time: string) => {
    setAnswer("bedtime_reminder_time", time);
    setPickerVisible(false);
  };

  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>Stay on track with a bedtime reminder.</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          We'll remind you when it's time to start tracking so you don't forget. You can change this anytime in Settings.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <Text style={styles.reminderRowLabel}>Bedtime reminder</Text>
        <TouchableOpacity
          style={styles.reminderRow}
          onPress={openPicker}
          activeOpacity={0.85}
        >
          <View style={styles.reminderRowLeft}>
            <Ionicons name="moon-outline" size={22} color={accent.primary} style={styles.reminderRowIcon} />
            <Text style={styles.reminderRowTime}>{formatTimeLabel(bedtime)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={text.muted} />
        </TouchableOpacity>
      </AnimatedStepItem>

      <Modal visible={pickerVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.timePickerOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.timePickerSheet}>
            <Text style={styles.timePickerTitle}>Choose time</Text>
            <FlatList
              data={BEDTIME_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.timePickerOption, item === bedtime && styles.timePickerOptionSelected]}
                  onPress={() => onSelectTime(item)}
                >
                  <Text style={[styles.timePickerOptionText, item === bedtime && styles.timePickerOptionTextSelected]}>
                    {formatTimeLabel(item)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function Step23Health() {
  const { answers, setAnswer } = useOnboarding();
  const [weightInput, setWeightInput] = useState(
    answers.weight_kg != null && answers.weight_kg > 0 ? String(answers.weight_kg) : ""
  );
  const [heightInput, setHeightInput] = useState(
    answers.height_cm != null && answers.height_cm > 0 ? String(answers.height_cm) : ""
  );

  const handleWeightChange = (t: string) => {
    setWeightInput(t);
    const n = parseFloat(t.replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n < 300) setAnswer("weight_kg", Math.round(n * 10) / 10);
    else if (t.trim() === "") setAnswer("weight_kg", undefined);
  };

  const handleHeightChange = (t: string) => {
    setHeightInput(t);
    const n = parseFloat(t.replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n < 250) setAnswer("height_cm", Math.round(n));
    else if (t.trim() === "") setAnswer("height_cm", undefined);
  };

  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>Weight & height</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          We use this to calculate your BMI and personalise insights. You can change it anytime in Profile.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <View style={styles.bodyFormRow}>
          <View style={styles.bodyFormField}>
            <Text style={styles.bodyFormLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.bodyFormInput}
              placeholder="e.g. 72"
              placeholderTextColor={text.muted}
              value={weightInput}
              onChangeText={handleWeightChange}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.bodyFormField}>
            <Text style={styles.bodyFormLabel}>Height (cm)</Text>
            <TextInput
              style={styles.bodyFormInput}
              placeholder="e.g. 175"
              placeholderTextColor={text.muted}
              value={heightInput}
              onChangeText={handleHeightChange}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          Optional — skip if you prefer; you can add it later in Profile.
        </Text>
      </AnimatedStepItem>
    </>
  );
}

type InviteModalMode = "email" | "link";

function Step24PartnerInvite({ answers }: { answers: OnboardingAnswers }) {
  const { setAnswer } = useOnboarding();
  const partnerName = (answers.partner_name ?? "").trim();
  const partnerEmail = (answers.partner_email ?? "").trim();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteModalMode, setInviteModalMode] = useState<InviteModalMode>("link");
  const [emailInput, setEmailInput] = useState(partnerEmail);

  const inviteUrl = getPartnerCheckInUrl(getTodayNightKey());

  const openInviteModal = () => {
    if (partnerEmail) {
      setInviteModalMode("link");
      setEmailInput(partnerEmail);
    } else {
      setInviteModalMode("email");
      setEmailInput("");
    }
    setInviteModalVisible(true);
  };

  const submitEmailAndShowLink = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    setAnswer("partner_email", trimmed);
    setInviteModalMode("link");
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${PARTNER_CHECKIN_SHARE_MESSAGE}\n\n${inviteUrl}`,
        url: inviteUrl,
        title: "QuietNight — How did you sleep?",
      });
    } catch {
      // User cancelled or share failed
    }
  };

  const closeModal = () => {
    setInviteModalVisible(false);
  };

  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>
          {partnerName ? `Invite ${partnerName} to join your experiment.` : "Invite your partner to join your experiment."}
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          Share a link and they'll get a quick setup on their phone. Their morning check-ins are what make QuietNight truly powerful — and couples who test together see results twice as fast.
        </Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <TouchableOpacity style={styles.invitePartnerButton} onPress={openInviteModal} activeOpacity={0.8}>
          <Ionicons name="person-add-outline" size={22} color={background.primary} />
          <Text style={styles.invitePartnerButtonText}>
            {partnerName ? `Invite ${partnerName}` : "Invite partner"}
          </Text>
        </TouchableOpacity>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <Text style={styles.supporting}>
          You can send the invite now or do it later from the app. Either way, we'll remind you.
        </Text>
      </AnimatedStepItem>

      <Modal visible={inviteModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.inviteModalContent}
          >
            <View style={styles.inviteModalCard}>
              {inviteModalMode === "email" ? (
                <>
                  <Text style={styles.inviteModalTitle}>Partner&apos;s email</Text>
                  <Text style={styles.inviteModalSub}>
                    We&apos;ll use this to send the invite. You can also share the link manually after.
                  </Text>
                  <TextInput
                    value={emailInput}
                    onChangeText={setEmailInput}
                    placeholder="e.g. sarah@example.com"
                    placeholderTextColor={text.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.inviteEmailInput}
                  />
                  <View style={styles.inviteModalButtons}>
                    <GhostButton label="Cancel" onPress={closeModal} />
                    <PrimaryButton
                      label="Continue"
                      onPress={submitEmailAndShowLink}
                      disabled={!emailInput.trim()}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.inviteModalTitle}>Your invite link</Text>
                  <Text style={styles.inviteLinkCode} selectable>
                    {inviteUrl}
                  </Text>
                  <Text style={styles.inviteModalSub}>
                    Share this link with your partner via message or email. They can tap it to complete a quick check-in — no app required.
                  </Text>
                  <View style={styles.inviteModalButtons}>
                    <GhostButton label="Close" onPress={closeModal} />
                    <PrimaryButton label="Share link" onPress={handleShare} />
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function Step25Rate({ answers }: { answers: OnboardingAnswers }) {
  const hasPartner = answers.has_partner === true;
  return (
    <>
      <AnimatedStepItem index={0}>
        <Text style={styles.headline}>Enjoying QuietNight so far?</Text>
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <Text style={styles.subtext}>
          {hasPartner
            ? "A quick rating on the App Store helps other couples discover us — and means a lot to our small team. No pressure; you can do it now or maybe later."
            : "A quick rating on the App Store helps others discover us — and means a lot to our small team. No pressure; you can do it now or maybe later."}
        </Text>
      </AnimatedStepItem>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenPadding,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  skipRow: { flexDirection: "row" as const, justifyContent: "flex-end" as const, marginBottom: spacing.xs },
  skipText: { ...type.label, color: accent.link },
  backBtn: { padding: spacing.xs, marginRight: spacing.sm },
  progressArea: { flex: 1 },
  progressWrap: { marginBottom: spacing.xs },
  progressText: { ...type.bodySm, color: text.secondary, marginBottom: spacing.xs },
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
  headline: {
    ...type.headingLg,
    color: text.primary,
    marginBottom: spacing.sm,
  },
  subtext: {
    ...type.bodyMd,
    color: text.secondary,
    marginBottom: spacing.lg,
  },
  welcomeLead: {
    ...type.bodyLg,
    color: accent.primary,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  nameInputWrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: background.tertiary,
    backgroundColor: background.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  nameInput: {
    ...type.bodyLg,
    color: text.primary,
    padding: 0,
  },
  fieldLabel: {
    ...type.label,
    color: text.secondary,
  },
  generatingPhrase: {
    ...type.headingLg,
    color: text.primary,
    marginBottom: spacing.lg,
    textAlign: "center",
    width: "100%",
  },
  subtextCompact: {
    ...type.bodySm,
    color: text.secondary,
    marginBottom: spacing.sm,
  },
  supporting: {
    ...type.bodySm,
    color: text.muted,
    marginBottom: spacing.lg,
  },
  illustWrap: { alignItems: "center", marginBottom: spacing.lg },
  illustWrapFullBleed: {
    alignItems: "center",
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.screenPadding,
  },
  illustCircle: {
    width: ILLUST_SIZE,
    height: ILLUST_SIZE,
    borderRadius: ILLUST_SIZE / 2,
    backgroundColor: "rgba(101, 102, 195, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buildingPlanBarWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  buildingPlanBarTrack: {
    height: 10,
    backgroundColor: background.input,
    borderRadius: 5,
    overflow: "hidden",
  },
  buildingPlanBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: accent.primary,
    borderRadius: 5,
  },
  buildingPlanBarPercentWrap: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  circularProgressWrap: {
    alignItems: "center",
    marginBottom: spacing.lg,
    position: "relative",
  },
  circularProgressSvgRotate: {
    transform: [{ rotate: "-90deg" }],
  },
  circularProgressSvg: {},
  circularProgressCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  circularProgressPercent: {
    ...type.displayMd,
    color: text.primary,
    fontWeight: "700",
  },
  circularProgressLabel: {
    ...type.bodyMd,
    color: text.secondary,
    marginTop: 4,
  },
  circularProgressDots: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.md,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  circularProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: background.input,
  },
  circularProgressDotActive: {
    backgroundColor: accent.primary,
    transform: [{ scale: 1.2 }],
  },
  reminderRowLabel: {
    ...type.label,
    color: text.primary,
    marginBottom: spacing.xs,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: background.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: background.tertiary,
    marginBottom: spacing.md,
  },
  reminderRowLeft: { flexDirection: "row", alignItems: "center" },
  reminderRowIcon: { marginRight: spacing.sm },
  reminderRowTime: {
    ...type.bodyLg,
    color: text.primary,
  },
  timePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  timePickerSheet: {
    backgroundColor: background.secondary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 24,
    maxHeight: "50%",
  },
  timePickerTitle: {
    ...type.headingMd,
    color: text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  timePickerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.screenPadding,
  },
  timePickerOptionSelected: {
    backgroundColor: accent.tealSoftBg,
  },
  timePickerOptionText: {
    ...type.bodyLg,
    color: text.secondary,
  },
  timePickerOptionTextSelected: {
    color: accent.primary,
    fontWeight: "600",
  },
  invitePartnerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: accent.primary,
    marginBottom: spacing.lg,
  },
  invitePartnerButtonText: {
    ...type.bodyLg,
    fontFamily: fonts.headingSemi,
    color: background.primary,
  },
  bodyFormRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  bodyFormField: { flex: 1 },
  bodyFormLabel: {
    ...type.label,
    color: text.secondary,
    marginBottom: 4,
  },
  bodyFormInput: {
    ...type.body,
    color: text.primary,
    backgroundColor: background.input,
    borderRadius: radius.input,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.screenPadding,
  },
  inviteModalContent: {
    width: "100%",
  },
  inviteModalCard: {
    backgroundColor: background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
  },
  inviteModalTitle: {
    ...type.headingMd,
    color: text.primary,
    marginBottom: spacing.xs,
  },
  inviteModalSub: {
    ...type.bodySmall,
    color: text.secondary,
    marginBottom: spacing.md,
  },
  inviteEmailInput: {
    ...type.bodyLg,
    color: text.primary,
    backgroundColor: background.input,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  inviteLinkCode: {
    ...type.bodySmall,
    color: accent.primary,
    backgroundColor: background.input,
    borderRadius: radius.button,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  inviteModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statsRow: { marginBottom: spacing.md },
  stat: { ...type.bodyMd, color: accent.primary, marginBottom: spacing.xs },
  statCard: {
    backgroundColor: background.secondary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  testimonial: {
    backgroundColor: background.secondary,
    borderRadius: 12,
    padding: spacing.md,
  },
  testimonialQuote: { ...type.bodyMd, color: text.primary, fontStyle: "italic" },
  testimonialAuthor: { ...type.bodySm, color: text.secondary, marginTop: spacing.xs },
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
  pillList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
    backgroundColor: background.secondary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pillSelected: {
    backgroundColor: "rgba(101, 102, 195, 0.3)",
    borderColor: accent.primary,
  },
  pillLabel: { ...type.bodyMd, color: text.secondary },
  pillLabelSelected: { color: text.primary, fontFamily: "Poppins_500Medium" },
  emojiRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.lg },
  emojiBtn: {
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: background.secondary,
  },
  emojiBtnSelected: { backgroundColor: "rgba(101, 102, 195, 0.3)" },
  emojiText: { fontSize: 28 },
  emojiNum: { ...type.bodySm, color: text.secondary, marginTop: spacing.xs },
  emojiNumSelected: { color: accent.primary },
  emojiScaleLabel: {
    ...type.micro,
    color: text.muted,
    marginTop: spacing.xs,
    textAlign: "center",
    maxWidth: 56,
  },
  emojiScaleLabelSelected: { color: text.secondary },
  severityCardList: { gap: spacing.sm, marginBottom: spacing.lg },
  severityCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: background.secondary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: spacing.sm,
  },
  severityCardSelected: {
    backgroundColor: "rgba(101, 102, 195, 0.25)",
    borderColor: accent.primary,
  },
  severityCardIconWrap: { marginRight: spacing.sm },
  severityCardLabel: { ...type.bodyMd, color: text.secondary, flex: 1 },
  severityCardLabelSelected: { color: text.primary, fontFamily: "Poppins_500Medium" },
  step16Scroll: { marginHorizontal: -spacing.screenPadding, marginBottom: spacing.sm },
  step16ScrollContent: {},
  step16PageWrap: { paddingHorizontal: spacing.screenPadding },
  step16Page: { flex: 1, justifyContent: "center", minHeight: 200 },
  step16Card: {
    backgroundColor: background.secondary,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  step16PanelTitle: {
    ...type.headingMd,
    color: text.primary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  step16PanelDesc: {
    ...type.bodyMd,
    color: text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  step16Dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: spacing.md,
  },
  step16Dot: { borderRadius: 9999 },
  step16DotActive: { width: 8, height: 8, backgroundColor: accent.primary },
  step16DotInactive: { width: 6, height: 6, backgroundColor: text.muted },
  experimentPanels: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  experimentPanel: {
    flex: 1,
    backgroundColor: background.secondary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
  },
  panelLabel: { ...type.bodySm, color: text.primary, marginTop: spacing.xs },
  panelDesc: {
    ...type.micro,
    color: text.muted,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  bulletList: { marginBottom: spacing.lg },
  bullet: { ...type.bodyMd, color: text.secondary, marginBottom: spacing.xs },
  journeyChartSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.md,
  },
  planValueList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planValueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  planValueText: {
    ...type.bodyMd,
    color: text.secondary,
    flex: 1,
  },
  journeyChartWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    flexWrap: "nowrap",
  },
  journeyPieContainer: {
    width: JOURNEY_PIE_SIZE,
    height: JOURNEY_PIE_SIZE,
    position: "relative",
  },
  journeyPieSegmentWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    width: JOURNEY_PIE_SIZE,
    height: JOURNEY_PIE_SIZE,
  },
  journeyLegend: {
    gap: spacing.sm,
  },
  journeyLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  journeyLegendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  journeyLegendLabel: {
    ...type.bodyMd,
    color: text.primary,
  },
  sliderRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  weekBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: background.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  weekBtnSelected: { backgroundColor: accent.primary },
  weekLabel: { ...type.bodyMd, color: text.secondary },
  weekLabelSelected: { color: "white" },
  buttonWrap: { marginTop: spacing.xl },
});
