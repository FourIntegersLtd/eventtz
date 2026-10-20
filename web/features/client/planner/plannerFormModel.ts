/** Structured fields on C06 compose the planner API `prompt` (still a single string on the server). */

export type PlannerEventTypeId =
  | "wedding"
  | "birthday"
  | "corporate"
  | "baby_shower"
  | "graduation"
  | "other";

export const PLANNER_EVENT_TYPE_OPTIONS: { id: PlannerEventTypeId; label: string }[] = [
  { id: "wedding", label: "Wedding" },
  { id: "birthday", label: "Birthday" },
  { id: "corporate", label: "Corporate" },
  { id: "baby_shower", label: "Baby shower" },
  { id: "graduation", label: "Graduation" },
  { id: "other", label: "Other" },
];

export type PlannerFormFields = {
  eventType: PlannerEventTypeId;
  preferredDate: string;
  guestCount: string;
  budget: string;
  location: string;
  details: string;
};

export const EMPTY_PLANNER_FORM: PlannerFormFields = {
  eventType: "birthday",
  preferredDate: "",
  guestCount: "",
  budget: "",
  location: "",
  details: "",
};

function eventTypeLabel(id: PlannerEventTypeId): string {
  return PLANNER_EVENT_TYPE_OPTIONS.find((option) => option.id === id)?.label ?? "celebration";
}

/** Builds the prompt sent to `POST /client/planner/plans`. */
export function composePlannerPrompt(form: PlannerFormFields): string {
  const details = form.details.trim();
  if (details) return details;

  const label = eventTypeLabel(form.eventType);
  const opener =
    form.eventType === "other"
      ? "Help me plan my celebration"
      : `Help me plan my ${label.toLowerCase()}`;

  const parts: string[] = [];
  if (form.location.trim()) parts.push(`in ${form.location.trim()}`);
  if (form.guestCount.trim()) parts.push(`for about ${form.guestCount.trim()} guests`);
  if (form.budget.trim()) {
    const budget = form.budget.trim();
    parts.push(`with a budget of ${budget.startsWith("£") ? budget : `£${budget}`}`);
  }
  if (form.preferredDate.trim()) parts.push(`on ${form.preferredDate.trim()}`);

  if (!parts.length) return opener;
  return `${opener} ${parts.join(" ")}.`;
}

export function plannerFormFromPrompt(prompt: string): PlannerFormFields {
  return { ...EMPTY_PLANNER_FORM, details: prompt };
}
