"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ADMIN_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { AccountStatusBadge } from "@/components/badges/AccountStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { patchClientSuspended, type AdminClientRow } from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { useAdminClients, type ClientSuspendedFilter } from "@/features/admin/clients/useAdminClients";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/dateFormat";

function clientInitials(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

function clientDisplayName(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  if (!local) return "Client";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const CLIENT_STATUS_FILTER_OPTIONS: EzFilterOption<ClientSuspendedFilter>[] = [
  { id: "", title: "All clients" },
  { id: "false", title: "Active", subtitle: "Accounts in good standing" },
  { id: "true", title: "Suspended", subtitle: "Cannot sign in or book" },
];

function clientStatusFilterLabel(value: ClientSuspendedFilter): string {
  return CLIENT_STATUS_FILTER_OPTIONS.find((option) => option.id === value)?.title ?? "Status";
}

function joinedLabel(createdAt: string | null | undefined): string {
  if (!createdAt) return "-";
  const date = new Date(String(createdAt));
  if (Number.isNaN(date.getTime())) return String(createdAt).slice(0, 10);
  return formatDate(date, "monthYear");
}

export function AdminClientsView() {
  const { canSuspendClients } = useAdminPermissions();
  const { showToast } = useToast();
  const {
    rows,
    total,
    offset,
    limit,
    goNext,
    goPrevious,
    loading,
    error,
    search,
    setSearch,
    suspendedFilter,
    setSuspendedFilter,
    reload,
  } = useAdminClients();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminClientRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  const selected = useMemo(
    () => rows.find((row) => row.user_id === selectedId) ?? null,
    [rows, selectedId],
  );


  const hasActiveFilters = Boolean(search.trim()) || Boolean(suspendedFilter);

  const clearFilters = () => {
    setSearch("");
    setSuspendedFilter("");
    setSelectedId(null);
  };

  const toggleSuspended = async (row: AdminClientRow) => {
    setBusyId(row.user_id);
    const nextSuspended = !row.account_suspended;
    try {
      await patchClientSuspended(row.user_id, nextSuspended);
      setConfirmTarget(null);
      await reload();
      showToast({
        title: nextSuspended ? "Client suspended" : "Client reinstated",
        description: row.email ?? undefined,
        tone: "success",
      });
    } catch (e: unknown) {
      const message = getApiErrorDetail(e) ?? "Could not update client status.";
      showToast({ title: "Update failed", description: message, tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="ez-split">
      <div className="ez-split__main ez-stack ez-stack--lg">
        {error ? <AdminErrorBanner message={error} /> : null}

        <EzListFilterToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setSelectedId(null);
          }}
          searchPlaceholder="Search email"
          searchAriaLabel="Search email"
          onOpenFilter={() => setStatusFilterOpen(true)}
          activeFilterCount={suspendedFilter ? 1 : 0}
          summary={
            suspendedFilter
              ? {
                  label: clientStatusFilterLabel(suspendedFilter),
                  onClear: () => {
                    setSuspendedFilter("");
                    setSelectedId(null);
                  },
                }
              : null
          }
        />

        <EzFilterOptionsModal
          isOpen={statusFilterOpen}
          onClose={() => setStatusFilterOpen(false)}
          title="Filter clients"
          description="Narrow the directory by account status. Search still applies on top."
          options={CLIENT_STATUS_FILTER_OPTIONS}
          value={suspendedFilter}
          onChange={(id) => {
            setSuspendedFilter(id);
            setSelectedId(null);
          }}
          listAriaLabel="Client account status"
          resetValue=""
          resetLabel="Show all"
        />

        {loading && rows.length === 0 ? (
          <AdminLoadingState label="Loading clients…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No clients match your filters"
            lottie="searchNoResults"
            action={
              hasActiveFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable
              aria-label="Clients"
              tableClassName="min-w-[36rem]"
              rows={rows}
              getRowKey={(row) => row.user_id}
              rowClassName={(row) => (row.user_id === selectedId ? "ez-table-row--active" : undefined)}
              onRowClick={(row) => setSelectedId(row.user_id)}
              columns={[
                {
                  key: "client",
                  header: "Client",
                  kind: "strong",
                  className: "min-w-[12rem]",
                  cell: (row) => (
                    <div className="ez-hrow flex-nowrap gap-2.5">
                      <span className="ez-avatar ez-avatar--sm">{clientInitials(row.email)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="ez-strong truncate">{clientDisplayName(row.email)}</div>
                        <div className="ez-caption truncate">{row.email ?? "-"}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "bookings",
                  header: "Bookings",
                  kind: "num",
                  className: "tabular-nums",
                  cell: (row) => row.booking_count,
                },
                { key: "joined", header: "Joined", cell: (row) => joinedLabel(row.created_at) },
                {
                  key: "status",
                  header: "Status",
                  kind: "status",
                  cell: (row) => <AccountStatusBadge suspended={row.account_suspended} />,
                },
              ]}
            />
            <TablePagination
              offset={offset}
              limit={limit}
              total={total}
              pageRowCount={rows.length}
              onPrevious={goPrevious}
              onNext={goNext}
            />
          </>
        )}
      </div>

      <div className="ez-split__aside ez-stack ez-stack--lg">
        {selected ? (
          <Card as="section">
            <Card.Header>
              <h2 className="ez-h3">{clientDisplayName(selected.email)}</h2>
            </Card.Header>
            <Card.Body>
              <div className="ez-stack">
                <div className="ez-hrow">
                  <span className="ez-avatar ez-avatar--lg">{clientInitials(selected.email)}</span>
                  <div>
                    <AccountStatusBadge suspended={selected.account_suspended} />
                    <div className="ez-caption">{selected.email ?? "-"}</div>
                  </div>
                </div>
                <DescriptionList
                  items={[
                    { label: "Joined", value: joinedLabel(selected.created_at) },
                    { label: "Bookings", value: selected.booking_count },
                  ]}
                />
                <hr className="ez-divider" />
                <div className="ez-hrow">
                  <ButtonLink
                    variant="secondary"
                    size="sm"
                    href={`/admin/commerce?tab=bookings&q=${encodeURIComponent(selected.email ?? "")}`}
                  >
                    View bookings
                  </ButtonLink>
                  <ButtonLink
                    variant="secondary"
                    size="sm"
                    href={`/admin/messages?tab=compose&to=${encodeURIComponent(selected.user_id)}`}
                  >
                    Message
                  </ButtonLink>
                  {canSuspendClients ? (
                    <Button
                      size="sm"
                      variant={selected.account_suspended ? "secondary" : "destructive"}
                      disabled={busyId === selected.user_id}
                      onClick={() => setConfirmTarget(selected)}
                    >
                      {selected.account_suspended ? "Reinstate" : "Suspend"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <Card as="section">
            <Card.Body>
              <p className="ez-small">Select a client to see account actions.</p>
            </Card.Body>
          </Card>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        title={
          confirmTarget?.account_suspended
            ? ADMIN_CONFIRM_COPY.unsuspendClient.title
            : ADMIN_CONFIRM_COPY.suspendClient.title
        }
        description={
          confirmTarget?.account_suspended
            ? ADMIN_CONFIRM_COPY.unsuspendClient.description
            : ADMIN_CONFIRM_COPY.suspendClient.description
        }
        confirmLabel={
          confirmTarget?.account_suspended
            ? ADMIN_CONFIRM_COPY.unsuspendClient.confirmLabel
            : ADMIN_CONFIRM_COPY.suspendClient.confirmLabel
        }
        confirmVariant={confirmTarget?.account_suspended ? "primary" : "destructive"}
        lottie={confirmTarget?.account_suspended ? "successCheck" : "failure"}
        loading={busyId === confirmTarget?.user_id}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) void toggleSuspended(confirmTarget);
        }}
      />
    </div>
  );
}
