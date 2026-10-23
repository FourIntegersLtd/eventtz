"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getApiErrorDetail } from "@/lib/api-errors";
import { ensurePlanClientEvent } from "@/lib/clientPlannerApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { PageHeader } from "@/components/ui/PageHeader";
import { BudgetBreakdown } from "./BudgetBreakdown";
import { PlannerGeneratingState } from "./PlannerGeneratingState";
import { PlannerPromptHero } from "./PlannerPromptHero";
import { PlannerSavedPlansList } from "./PlannerSavedPlansList";
import { RecommendationSection } from "./RecommendationSection";
import { PLANNER_COPY } from "./plannerCopy";
import {
  buildPlannerBrowseUrl,
  celebrationMetaLine,
  primaryVendorsFromPlan,
} from "./plannerModel";
import {
  composePlannerPrompt,
  EMPTY_PLANNER_FORM,
  plannerFormFromPrompt,
  type PlannerFormFields,
} from "./plannerFormModel";
import { plannerConfidenceBadge } from "./plannerConfidence";
import { useGeneratePlan } from "./useGeneratePlan";
import { formatGbp } from "@/lib/money";

export function AiPlannerView({ initialPlanId }: { initialPlanId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q")?.trim() || "";

  const [form, setForm] = useState<PlannerFormFields>(() =>
    qFromUrl ? plannerFormFromPrompt(qFromUrl) : { ...EMPTY_PLANNER_FORM },
  );
  const [loadingTick, setLoadingTick] = useState(0);
  const [browseHandoffBusy, setBrowseHandoffBusy] = useState(false);
  const [browseHandoffError, setBrowseHandoffError] = useState<string | null>(null);
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(() => new Set());

  const {
    loading,
    replacingNeedId,
    error,
    simpleIntent,
    plan,
    recentPlans,
    generate,
    loadPlan,
    replaceNeed,
    refreshList,
    setPlan,
  } = useGeneratePlan();

  const onMount = useEffectEvent(() => {
    track(MixpanelEvents.planner_opened);
    void refreshList();
    if (initialPlanId) {
      void loadPlan(initialPlanId);
    } else if (qFromUrl) {
      void generate(qFromUrl);
    }
  });

  useEffect(() => {
    onMount();
  }, [initialPlanId]);

  useEffect(() => {
    if (!loading) {
      setLoadingTick(0);
      return;
    }
    const id = window.setInterval(() => {
      setLoadingTick((step) => (step + 1) % PLANNER_COPY.loadingLabels.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (plan?.plan_id && plan.plan_id !== initialPlanId) {
      router.replace(`/client/planner/${plan.plan_id}`);
    }
  }, [plan?.plan_id, initialPlanId, router]);

  useEffect(() => {
    if (!plan) {
      setSelectedVendorIds(new Set());
      return;
    }
    setSelectedVendorIds(new Set(primaryVendorsFromPlan(plan).map((vendor) => vendor.user_id)));
  }, [plan?.plan_id]);

  const showForm = !initialPlanId && !plan;
  const showResults = Boolean(plan);

  const handleSubmit = () => {
    const prompt = composePlannerPrompt(form);
    if (!prompt.trim()) return;
    void generate(prompt);
  };

  const handleFormChange = (patch: Partial<PlannerFormFields>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const toggleVendor = (vendorUserId: string) => {
    setSelectedVendorIds((current) => {
      const next = new Set(current);
      if (next.has(vendorUserId)) next.delete(vendorUserId);
      else next.add(vendorUserId);
      return next;
    });
  };

  const selectedCount = selectedVendorIds.size;

  const handleBrowseHandoff = () => {
    if (!plan) return;
    setBrowseHandoffError(null);
    setBrowseHandoffBusy(true);
    const vendorIds = [...selectedVendorIds];
    void (async () => {
      try {
        const ensured = plan.client_event_id
          ? { event_id: plan.client_event_id }
          : await ensurePlanClientEvent(plan.plan_id);
        track(MixpanelEvents.planner_plan_viewed, {
          action: "browse_handoff",
          plan_id: plan.plan_id,
          event_id: ensured.event_id,
        });
        router.push(buildPlannerBrowseUrl(plan, ensured.event_id, vendorIds));
      } catch (err: unknown) {
        setBrowseHandoffError(getApiErrorDetail(err) ?? "Could not open marketplace.");
        setBrowseHandoffBusy(false);
      }
    })();
  };

  const handleEditDetails = () => {
    if (!plan) return;
    setPlan(null);
    setForm({
      ...EMPTY_PLANNER_FORM,
      details: plan.brief.raw_prompt?.trim() || "",
      location: plan.celebration.location ?? plan.brief.location ?? "",
      guestCount: plan.celebration.guest_count ? String(plan.celebration.guest_count) : "",
      budget:
        plan.celebration.budget_gbp != null ? formatGbp(plan.celebration.budget_gbp, { decimals: "upTo2" }) : "",
      preferredDate: plan.celebration.preferred_date ?? plan.brief.preferred_date ?? "",
    });
    router.push("/client/planner");
  };

  const confidence = useMemo(
    () => (plan ? plannerConfidenceBadge(plan.confidence.score) : null),
    [plan],
  );

  return (
    <div className="ez-stack ez-stack--lg">
      {showForm ? (
        <>
          <PlannerPromptHero
            form={form}
            onFormChange={handleFormChange}
            onSubmit={handleSubmit}
            loading={loading}
          />

          {simpleIntent ? (
            <Banner
              tone="warning"
              action={
                <ButtonLink
                  href={`/client/browse?q=${encodeURIComponent(composePlannerPrompt(form))}`}
                  variant="secondary"
                  size="sm"
                >
                  {PLANNER_COPY.browseCta}
                </ButtonLink>
              }
            >
              {error || PLANNER_COPY.simpleIntentHint}
            </Banner>
          ) : null}

          {error && !simpleIntent ? <LottieFailureInline message={error} /> : null}

          {loading ? <PlannerGeneratingState activeStepIndex={loadingTick} /> : null}

          {!loading ? <PlannerSavedPlansList plans={recentPlans} /> : null}

          <p className="ez-caption">
            Prefer browsing?{" "}
            <Link href="/client/browse" className="ez-link">Open the marketplace</Link>
          </p>
        </>
      ) : null}

      {initialPlanId && loading && !plan ? (
        <PlannerGeneratingState activeStepIndex={loadingTick} />
      ) : null}

      {initialPlanId && error && !plan && !loading ? <LottieFailureInline message={error} /> : null}

      {showResults && plan ? (
        <div className="ez-stack ez-stack--lg">
          {initialPlanId ? (
            <BackLink href="/client/planner" label={PLANNER_COPY.backToPlanner} className="ez-back" />
          ) : null}

          <PageHeader
            eyebrow="Your plan"
            title={plan.celebration.title}
            actions={
              <Button
                variant="secondary"
                onClick={handleEditDetails}
                icon={<Pencil width={18} height={18} strokeWidth={1.75} aria-hidden />}
              >
                {PLANNER_COPY.editDetails}
              </Button>
            }
          />
          {celebrationMetaLine(plan) && confidence ? (
            <p className="ez-body">
              {celebrationMetaLine(plan)} · <Badge tone={confidence.tone}>{confidence.label}</Badge>
            </p>
          ) : null}

          {browseHandoffError ? <LottieFailureInline message={browseHandoffError} /> : null}

          <div className="ez-split">
            <div className="ez-split__main ez-stack ez-stack--xl">
              {plan.recommendations.map((rec) => (
                <RecommendationSection
                  key={rec.need_id}
                  plan={plan}
                  recommendation={rec}
                  replacing={replacingNeedId === rec.need_id}
                  onReplace={() => void replaceNeed(rec.need_id)}
                  selectedVendorIds={selectedVendorIds}
                  onToggleVendor={toggleVendor}
                />
              ))}
            </div>
            <div className="ez-split__aside flex-[0_1_340px]">
              <BudgetBreakdown
                budget={plan.budget}
                selectedCount={selectedCount}
                enquiryBusy={browseHandoffBusy}
                enquiryDisabled={selectedCount === 0}
                onSendEnquiry={handleBrowseHandoff}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
