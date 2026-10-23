"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ADMIN_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { AccountStatusBadge } from "@/components/badges/AccountStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { patchClientSuspended, type AdminClientRow } from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { adminFilterControlClass } from "@/features/admin/components/adminFilterControlClass";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { useAdminClients } from "@/features/admin/clients/useAdminClients";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
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

type ClientSuspendedFilter = "" | "true" | "false";

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
    setOffset,
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
    setOffset(0);
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
            setOffset(0);
            setSearch(value);
            setSelectedId(null);
          }}
          searchPlaceholder="Search email"
          searchAriaLabel="Search email"
          inputClassName={adminFilterControlClass}
          onOpenFilter={() => setStatusFilterOpen(true)}
          activeFilterCount={suspendedFilter ? 1 : 0}
          summary={
            suspendedFilter
              ? {
                  label: clientStatusFilterLabel(suspendedFilter as ClientSuspendedFilter),
                  onClear: () => {
                    setOffset(0);
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
          value={suspendedFilter as ClientSuspendedFilter}
          onChange={(id) => {
            setOffset(0);
            setSuspendedFilter(id);
            setSelectedId(null);
          }}
          listAriaLabel="Client account status"
          resetValue=""
          resetLabel="Show all"
        />

        {loading ? (
          <AdminLoadingState label="Loading clients…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No clients match your filters"
            lottie="searchNoResults"
            action={
              hasActiveFilters ? (
                <button type="button" className="ez-btn ez-btn--secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <AdminTable>
              <AdminTableElement className="min-w-[36rem]">
                <AdminTableHead>
                  <AdminTableHeaderCell>Client</AdminTableHeaderCell>
                  <AdminTableHeaderCell className="ez-td-num">Bookings</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Joined</AdminTableHeaderCell>
                  <AdminTableHeaderCell className="ez-td-status">Status</AdminTableHeaderCell>
                </AdminTableHead>
                <AdminTableBody>
                  {rows.map((row) => {
                    const active = row.user_id === selectedId;
                    return (
                      <AdminTableRow
                        key={row.user_id}
                        className={active ? "ez-table-row--active" : undefined}
                        onClick={() => setSelectedId(row.user_id)}
                        style={{ cursor: "pointer" }}
                      >
                        <AdminTableCell className="ez-td-strong min-w-[12rem]">
                          <div className="ez-hrow" style={{ flexWrap: "nowrap", gap: "10px" }}>
                            <span className="ez-avatar ez-avatar--sm">
                              {clientInitials(row.email)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="ez-strong truncate">{clientDisplayName(row.email)}</div>
                              <div className="ez-caption truncate">{row.email ?? "-"}</div>
                            </div>
                          </div>
                        </AdminTableCell>
                        <AdminTableCell className="ez-td-num tabular-nums">
                          {row.booking_count}
                        </AdminTableCell>
                        <AdminTableCell>{joinedLabel(row.created_at)}</AdminTableCell>
                        <AdminTableCell className="ez-td-status">
                          <AccountStatusBadge suspended={row.account_suspended} />
                        </AdminTableCell>
                      </AdminTableRow>
                    );
                  })}
                </AdminTableBody>
              </AdminTableElement>
            </AdminTable>
            <TablePagination
              offset={offset}
              limit={limit}
              total={total}
              pageRowCount={rows.length}
              onPrevious={() => setOffset(Math.max(0, offset - limit))}
              onNext={() => setOffset(offset + limit)}
            />
          </>
        )}
      </div>

      <div className="ez-split__aside ez-stack ez-stack--lg">
        {selected ? (
          <section className="ez-card">
            <div className="ez-card__head">
              <h2 className="ez-h3">{clientDisplayName(selected.email)}</h2>
            </div>
            <div className="ez-card__body">
              <div className="ez-stack">
                <div className="ez-hrow">
                  <span className="ez-avatar ez-avatar--lg">{clientInitials(selected.email)}</span>
                  <div>
                    <AccountStatusBadge suspended={selected.account_suspended} />
                    <div className="ez-caption">{selected.email ?? "-"}</div>
                  </div>
                </div>
                <dl className="ez-dl" style={{ margin: 0 }}>
                  <dt>Joined</dt>
                  <dd>{joinedLabel(selected.created_at)}</dd>
                  <dt>Bookings</dt>
                  <dd>{selected.booking_count}</dd>
                </dl>
                <hr className="ez-divider" />
                <div className="ez-hrow">
                  <Link
                    href={`/admin/commerce?tab=bookings&q=${encodeURIComponent(selected.email ?? "")}`}
                    className="ez-btn ez-btn--secondary ez-btn--sm"
                  >
                    View bookings
                  </Link>
                  <Link
                    href={`/admin/messages?tab=compose&to=${encodeURIComponent(selected.user_id)}`}
                    className="ez-btn ez-btn--secondary ez-btn--sm"
                  >
                    Message
                  </Link>
                  {canSuspendClients ? (
                    <button
                      type="button"
                      disabled={busyId === selected.user_id}
                      onClick={() => setConfirmTarget(selected)}
                      className={
                        selected.account_suspended
                          ? "ez-btn ez-btn--secondary ez-btn--sm"
                          : "ez-btn ez-btn--danger-quiet ez-btn--sm"
                      }
                    >
                      {selected.account_suspended ? "Reinstate" : "Suspend"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="ez-card">
            <div className="ez-card__body">
              <p className="ez-small">Select a client to see account actions.</p>
            </div>
          </section>
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
