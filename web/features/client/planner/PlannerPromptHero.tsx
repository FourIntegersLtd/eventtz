"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  PLANNER_EVENT_TYPE_OPTIONS,
  type PlannerFormFields,
  type PlannerEventTypeId,
} from "./plannerFormModel";
import { PLANNER_COPY } from "./plannerCopy";

type PlannerPromptHeroProps = {
  form: PlannerFormFields;
  onFormChange: (patch: Partial<PlannerFormFields>) => void;
  onSubmit: () => void;
  loading: boolean;
};

/** C06 planner form: chips, grid fields, optional details, raised card footer. */
export function PlannerPromptHero({ form, onFormChange, onSubmit, loading }: PlannerPromptHeroProps) {
  return (
    <div className="ez-stack ez-stack--lg max-w-[860px]">
      <PageHeader
        eyebrow={PLANNER_COPY.heroEyebrow}
        title={PLANNER_COPY.heroHeadline}
        description={PLANNER_COPY.heroSupport}
      />

      <Card variant="raised">
        <Card.Body className="ez-stack ez-stack--lg">
          <div className="ez-field">
            <span className="ez-label" id="planner-event-type">Event type</span>
            <div className="ez-chip-row" role="group" aria-labelledby="planner-event-type">
              {PLANNER_EVENT_TYPE_OPTIONS.map((option) => {
                const active = form.eventType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={active ? "ez-chip ez-chip--active" : "ez-chip"}
                    onClick={() => onFormChange({ eventType: option.id as PlannerEventTypeId })}
                    disabled={loading}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ez-form-grid">
            <TextField
              id="planner-date"
              label="Date"
              type="text"
              value={form.preferredDate}
              onChange={(event) => onFormChange({ preferredDate: event.target.value })}
              disabled={loading}
              placeholder="Sat 14 Nov 2026"
            />
            <TextField
              id="planner-guests"
              label="Guests"
              type="number"
              min={1}
              inputMode="numeric"
              value={form.guestCount}
              onChange={(event) => onFormChange({ guestCount: event.target.value })}
              disabled={loading}
              placeholder="120"
            />
            <TextField
              id="planner-budget"
              label="Budget"
              type="text"
              inputMode="decimal"
              value={form.budget}
              onChange={(event) => onFormChange({ budget: event.target.value })}
              disabled={loading}
              placeholder="£5,000"
              hint="Your total, including everything."
            />
            <div className="ez-field">
              <label className="ez-label" htmlFor="planner-location">Location</label>
              <div className="ez-input-group">
                <MapPinIcon />
                <input
                  className="ez-input"
                  id="planner-location"
                  type="text"
                  value={form.location}
                  onChange={(event) => onFormChange({ location: event.target.value })}
                  disabled={loading}
                  placeholder="London"
                />
              </div>
            </div>
          </div>

          <TextArea
            id="planner-details"
            label={
              <>
                Tell us more <span className="ez-label__opt">(optional)</span>
              </>
            }
            rows={4}
            maxLength={2000}
            value={form.details}
            onChange={(event) => onFormChange({ details: event.target.value })}
            disabled={loading}
            placeholder={PLANNER_COPY.promptPlaceholder}
            hint="Mention style, dietary needs or must-haves."
          />
        </Card.Body>

        <Card.Footer>
          <span className="ez-caption mr-auto self-center">{PLANNER_COPY.generateHint}</span>
          <Button
            size="lg"
            disabled={loading}
            onClick={onSubmit}
            icon={<Sparkles width={18} height={18} strokeWidth={1.75} aria-hidden />}
          >
            {PLANNER_COPY.submitLabel}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

function MapPinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
