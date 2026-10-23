import { Card } from "@/components/ui/Card";

/** Static copy from design V12 — payout timing explainer. */
export function VendorPayoutHowItWorksCard() {
  return (
    <Card>
      <Card.Header>
        <span className="ez-h3">How payouts work</span>
      </Card.Header>
      <Card.Body>
        <div className="ez-lines">
          <div className="ez-lines__row">
            <span>Client pays Eventtz</span>
            <span>At booking, held safely</span>
          </div>
          <div className="ez-lines__row">
            <span>Event takes place</span>
            <span>Sat 14 Nov 2026</span>
          </div>
          <div className="ez-lines__row">
            <span>Both of you confirm, or 48 hours pass</span>
            <span>Payout is released</span>
          </div>
          <div className="ez-lines__row">
            <span>Funds reach your bank</span>
            <span>Usually 1 to 3 working days</span>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
