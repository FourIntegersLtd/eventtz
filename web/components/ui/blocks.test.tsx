import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { OptionCard } from "@/components/ui/OptionCard";
import { DataTable } from "@/components/ui/DataTable";
import { DescriptionList, DescriptionRow } from "@/components/ui/DescriptionList";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatTile } from "@/components/ui/StatTile";
import { Star } from "lucide-react";
import { Stepper } from "@/components/ui/Stepper";
import { Tabs } from "@/components/ui/Tabs";
import { TablePagination } from "@/components/ui/TablePagination";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";

/** The building blocks render the canvas classes in `design/canvas/project/eventtz.css`. */
describe("ui building blocks emit canvas markup", () => {
  it("Badge is an ez-badge with its tone modifier", () => {
    expect(renderToStaticMarkup(<Badge tone="success">Paid</Badge>)).toBe(
      '<span class="ez-badge ez-badge--success shrink-0">Paid</span>',
    );
  });

  it("Banner is an ez-banner with a body, title and actions", () => {
    expect(
      renderToStaticMarkup(
        <Banner tone="danger" title="Payment failed" action={<a href="/pay">Retry</a>}>
          Card declined.
        </Banner>,
      ),
    ).toBe(
      '<div role="alert" class="ez-banner ez-banner--danger"><div class="ez-banner__body"><span class="ez-banner__title">Payment failed</span><div>Card declined.</div></div><div class="ez-banner__actions"><a href="/pay">Retry</a></div></div>',
    );
  });

  it("Card maps variants and slots onto ez-card classes", () => {
    expect(renderToStaticMarkup(<Card padding="md">x</Card>)).toBe('<div class="ez-card shadow-xs p-5">x</div>');
    expect(renderToStaticMarkup(<Card variant="muted">x</Card>)).toBe('<div class="ez-card ez-card--flat">x</div>');
    expect(renderToStaticMarkup(<Card.Header>h</Card.Header>)).toBe('<div class="ez-card__head">h</div>');
    expect(renderToStaticMarkup(<Card.Footer>f</Card.Footer>)).toBe('<div class="ez-card__foot">f</div>');
  });

  it("Tabs render ez-tab with the active modifier and a capped count", () => {
    const markup = renderToStaticMarkup(
      <Tabs
        aria-label="Bookings"
        value="open"
        onChange={() => {}}
        options={[
          { value: "open", label: "Open", count: 120 },
          { value: "past", label: "Past" },
        ]}
      />,
    );
    expect(markup).toContain('<div role="tablist" aria-label="Bookings" class="ez-tabs">');
    expect(markup).toContain('class="ez-tab ez-tab--active">Open<span class="ez-tab__count">99+</span>');
    expect(markup).toContain('aria-selected="false" class="ez-tab">Past</button>');
  });

  it("Tabs with an href render links that keep the ez-tab classes", () => {
    const markup = renderToStaticMarkup(
      <Tabs
        aria-label="Settings sections"
        value="account"
        options={[
          { value: "account", label: "Account", href: "/vendor/settings" },
          { value: "referrals", label: "Referrals", href: "/vendor/settings?tab=referrals" },
        ]}
      />,
    );
    expect(markup).toContain('<a role="tab" aria-selected="true" class="ez-tab ez-tab--active" href="/vendor/settings">Account</a>');
    expect(markup).toContain('class="ez-tab" href="/vendor/settings?tab=referrals">Referrals</a>');
  });

  it("StatTile is an ez-kpi", () => {
    expect(renderToStaticMarkup(<StatTile label="Revenue" value="£1,200" delta="+4%" deltaTone="success" />)).toBe(
      '<div class="ez-kpi"><span class="ez-kpi__label">Revenue</span><span class="ez-kpi__value">£1,200</span><span class="ez-kpi__delta text-success">+4%</span></div>',
    );
  });

  it("PageHeader is an ez-pagehead", () => {
    expect(
      renderToStaticMarkup(<PageHeader eyebrow="Admin" title="Vendors" description="All vendors" actions={<b>go</b>} />),
    ).toBe(
      '<header class="ez-pagehead"><div class="ez-pagehead__text"><span class="ez-eyebrow">Admin</span><h1 class="ez-h1">Vendors</h1><p class="ez-small">All vendors</p></div><div class="ez-pagehead__actions"><b>go</b></div></header>',
    );
  });

  it("PageHeader can use body-size description", () => {
    expect(renderToStaticMarkup(<PageHeader title="Home" description="Hi" descriptionSize="body" />)).toContain(
      '<p class="ez-body">Hi</p>',
    );
  });

  it("StatTile renders icon, hint and link variants", () => {
    const markup = renderToStaticMarkup(<StatTile label="A" value={3} icon={Star} hint="h" />);
    expect(markup).toContain('<span class="ez-kpi__label"><svg');
    expect(markup).toContain('</svg>A</span><span class="ez-kpi__value">3</span><span class="ez-small">h</span></div>');
    expect(renderToStaticMarkup(<StatTile label="A" value="1" delta="d" deltaTone="danger" />)).toContain(
      'ez-kpi__delta ez-kpi__delta--down',
    );
    expect(renderToStaticMarkup(<StatTile label="A" value="1" href="/x" />)).toContain('<a class="ez-kpi ez-kpi--link" href="/x">');
  });

  it("Checkbox passes required through to the input", () => {
    expect(renderToStaticMarkup(<Checkbox checked={false} required onChange={() => {}}>Agree</Checkbox>)).toContain(
      'required=""',
    );
  });

  it("Checkbox is an ez-check row and OptionCard marks the chosen option", () => {
    expect(renderToStaticMarkup(<Checkbox checked onChange={() => {}}>Remember me</Checkbox>)).toContain(
      '<span>Remember me</span>',
    );
    const markup = renderToStaticMarkup(
      <OptionCard type="radio" checked onChange={() => {}} title="Solo" description="Just me" />,
    );
    expect(markup).toContain('class="ez-option ez-option--active"');
    expect(markup).toContain('<span class="ez-strong">Solo</span><span class="ez-small">Just me</span>');
  });

  it("DescriptionList is an ez-dl of dt and dd pairs", () => {
    expect(renderToStaticMarkup(<DescriptionList items={[{ label: "Total", value: "£10" }]} />)).toBe(
      '<dl class="ez-dl"><dt>Total</dt><dd>£10</dd></dl>',
    );
  });

  it("DescriptionList split rows divide and show a missing value in amber", () => {
    const markup = renderToStaticMarkup(
      <DescriptionList rowLayout="split" items={[{ label: "Bio", value: "-", missing: true }]} />,
    );
    expect(markup).toContain('<dl class="divide-y divide-neutral-100">');
    expect(markup).toContain(
      '<dd class="min-w-0 text-sm leading-snug sm:text-right font-medium text-amber-800">-</dd>',
    );
  });

  it("DescriptionRow review layout marks the field for the compact review card", () => {
    const markup = renderToStaticMarkup(<DescriptionRow layout="review" label="Email" value="a@b.co" />);
    expect(markup).toContain("data-review-field");
    expect(markup).toContain('<dd class="min-w-0 text-sm font-medium text-neutral-900 sm:text-right">a@b.co</dd>');
  });

  it("StatTile compact is a bordered card, not an ez-kpi", () => {
    const markup = renderToStaticMarkup(<StatTile compact label="Rating" value="4.9" />);
    expect(markup).toContain('class="h-full rounded-xl border border-neutral-100 bg-white px-3.5 py-3"');
    expect(markup).not.toContain("ez-kpi");
  });

  it("Stepper keeps the mobile step line and the connectors", () => {
    const markup = renderToStaticMarkup(<Stepper steps={["Account", "Business", "Review"]} current={1} />);
    expect(markup).toContain(
      '<p class="text-xs font-medium text-ink-3 sm:hidden">Step 2 of 3: Business</p>',
    );
    expect(markup).toContain('<span aria-hidden="true" class="h-px flex-1 bg-primary"></span>');
    expect(markup).toContain('<span aria-hidden="true" class="h-px flex-1 bg-line-strong"></span>');
  });

  it("TextField is an ez-field with label, ez-input and help or error", () => {
    expect(renderToStaticMarkup(<TextField id="n" label="Name" hint="As on your ID" />)).toBe(
      '<div class="ez-field"><label for="n" class="ez-label">Name</label><input id="n" aria-invalid="false" aria-describedby="n-hint" class="ez-input"/><span id="n-hint" class="ez-help">As on your ID</span></div>',
    );
    const withError = renderToStaticMarkup(<TextField id="n" label="Name" error="Required" />);
    expect(withError).toContain('class="ez-input ez-input--error"');
    expect(withError).toContain('<span id="n-error" class="ez-error-text" role="alert">Required</span>');
  });

  it("TextField shows the clear button only while it has a value", () => {
    const filled = renderToStaticMarkup(
      <TextField id="q" label="Search" hideLabel value="dj" onChange={() => {}} onClear={() => {}} />,
    );
    expect(filled).toContain('class="ez-label sr-only"');
    expect(filled).toContain('class="ez-clearable-input ez-clearable-input--has-value"');
    expect(filled).toContain('class="ez-clearable-input__clear" aria-label="Clear search"');
    const empty = renderToStaticMarkup(
      <TextField id="q" label="Search" value="" onChange={() => {}} onClear={() => {}} />,
    );
    expect(empty).toContain('<div class="ez-clearable-input">');
    expect(empty).not.toContain("ez-clearable-input__clear");
  });

  it("Select wraps an ez-input ez-select in ez-select-wrap", () => {
    const markup = renderToStaticMarkup(
      <Select id="s" label="Role">
        <option>A</option>
      </Select>,
    );
    expect(markup).toContain('<label for="s" class="ez-label">Role</label><div class="ez-select-wrap"><select id="s" aria-invalid="false" class="ez-input ez-select">');
  });

  it("TextArea is an ez-input--area", () => {
    expect(renderToStaticMarkup(<TextArea id="t" label="Notes" />)).toContain(
      '<textarea id="t" rows="4" aria-invalid="false" class="ez-input ez-input--area"></textarea>',
    );
  });

  it("EmptyState is an ez-empty with the icon in the art disc", () => {
    expect(renderToStaticMarkup(<EmptyState icon={<i>*</i>} title="Nothing yet" description="Come back soon" />)).toBe(
      '<div class="ez-empty"><div class="ez-empty__art"><i>*</i></div><h3 class="ez-h2">Nothing yet</h3><p class="ez-body">Come back soon</p></div>',
    );
  });

  it("TablePagination shows the visible range and disables Previous on page one", () => {
    const markup = renderToStaticMarkup(
      <TablePagination offset={0} limit={25} total={60} onPrevious={() => {}} onNext={() => {}} />,
    );
    expect(markup).toContain('<nav aria-label="Pagination" class="ez-between">');
    expect(markup).toContain("Showing 1-25 of 60");
    expect(markup).toContain('<button type="button" disabled="" class="ez-btn ez-btn--secondary ez-btn--sm">Previous</button>');
  });

  it("DataTable renders ez-table columns with cell kinds", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        aria-label="Vendors"
        embedded
        rows={[{ id: "v1", name: "Acme", total: 3 }]}
        getRowKey={(row) => row.id}
        columns={[
          { key: "name", header: "Name", kind: "strong", cell: (row) => row.name },
          { key: "total", header: "Total", kind: "num", cell: (row) => row.total },
        ]}
      />,
    );
    expect(markup).toBe(
      '<div class="ez-table-wrap w-full min-w-0 max-w-full ez-table-wrap--embedded"><table class="ez-table" aria-label="Vendors"><thead><tr><th scope="col">Name</th><th scope="col" class="ez-td-num">Total</th></tr></thead><tbody><tr><td class="ez-td-strong">Acme</td><td class="ez-td-num">3</td></tr></tbody></table></div>',
    );
  });
});
