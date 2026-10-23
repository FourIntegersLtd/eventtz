"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { DataTable } from "@/components/ui/DataTable";
import { AdminSuccessBanner } from "@/features/admin/components/AdminSuccessBanner";
import { AdminCreateAdminModal } from "@/features/admin/team/AdminCreateAdminModal";
import { AdminTeamMemberActionsMenu } from "@/features/admin/team/AdminTeamMemberActionsMenu";
import {
  fetchAdminTeamPage,
  isSuperAdmin,
  patchAdminTeamMember,
  sendAdminPasswordResetLink,
  deleteAdminTeamMember,
  type AdminTeamMember,
} from "@/lib/adminTeamApi";
import { useServerList } from "@/lib/useServerList";
import { getApiErrorDetail } from "@/lib/api-errors";
import { formControlClass } from "@/components/ui/tokens";
import { TablePagination } from "@/components/ui/TablePagination";

/** What each admin role may do, shown under the roster. */
const ROLE_CAPABILITY_ROWS = [
  { area: "Vendors, clients, bookings", admin: "Yes", superAdmin: "Yes" },
  { area: "Refunds and dispute decisions", admin: "Yes", superAdmin: "Yes" },
  { area: "Platform settings and fees", admin: "No", superAdmin: "Yes" },
  { area: "Team and roles", admin: "No", superAdmin: "Yes" },
  { area: "Email health", admin: "No", superAdmin: "Yes" },
];

function roleLabel(role: AdminTeamMember["admin_role"]): string {
  return role === "super_admin" ? "Super admin" : "Admin";
}

export function AdminTeamView() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const canManage = isSuperAdmin(user);

  const {
    items: members,
    total: rosterTotal,
    offset: rosterOffset,
    limit: rosterLimit,
    loading,
    error: loadError,
    goNext,
    goPrevious,
    reload,
  } = useServerList<AdminTeamMember, Record<string, never>>({
    filters: {},
    errorMessage: "Could not load admin team.",
    fetchPage: async ({ offset, limit }) => {
      const page = await fetchAdminTeamPage(offset, limit);
      return { items: page.members, total: page.total };
    },
  });
  const error = actionError ?? loadError;
  /** Reloads the roster and clears the last action error, as a fresh load did before. */
  const load = () => {
    setActionError(null);
    reload();
  };

  if (loading && members.length === 0) {
    return <AdminLoadingState label="Loading team…" />;
  }

  return (
    <div className="ez-stack ez-stack--lg">
      {error ? <AdminErrorBanner message={error} /> : null}
      {successMessage ? <AdminSuccessBanner message={successMessage} /> : null}

      {canManage ? (
        <div className="flex justify-end">
          <div className="ez-pagehead__actions">
            <Button
              icon={<UserPlus className="h-4 w-4" aria-hidden />}
              onClick={() => setCreateOpen(true)}
            >
              Create admin account
            </Button>
          </div>
        </div>
      ) : null}

      <AdminCreateAdminModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(message) => {
          setSuccessMessage(message);
          showToast({ title: "Admin created", description: message, tone: "success" });
          load();
        }}
      />

      {members.length === 0 ? (
        <EmptyState title="No admins yet" variant="team" />
      ) : (
        <DataTable
          aria-label="Admin team"
          tableClassName="min-w-[36rem]"
          rows={members}
          getRowKey={(m) => m.user_id}
          columns={[
            {
              key: "email",
              header: "Email",
              className: "font-medium text-ink",
              cell: (m) => (
                <>
                  {m.email ?? "-"}
                  {user?.id === m.user_id ? (
                    <span className="ml-2 text-xs font-normal text-ink-3">(you)</span>
                  ) : null}
                </>
              ),
            },
            {
              key: "role",
              header: "Role",
              cell: (m) =>
                canManage && user?.id !== m.user_id ? (
                  <select
                    value={m.admin_role}
                    disabled={rowBusy === m.user_id}
                    onChange={(e) => {
                    const next = e.target.value as AdminTeamMember["admin_role"];
                    void (async () => {
                      setRowBusy(m.user_id);
                      try {
                        await patchAdminTeamMember(m.user_id, { admin_role: next });
                        load();
                        showToast({
                          title: "Role updated",
                          description: roleLabel(next),
                          tone: "success",
                        });
                      } catch (err: unknown) {
                        const message = getApiErrorDetail(err) ?? "Could not update role.";
                        setActionError(message);
                        showToast({ title: "Role update failed", description: message, tone: "error" });
                      } finally {
                        setRowBusy(null);
                      }
                    })();
                    }}
                    className={formControlClass("px-2 py-1.5")}
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super admin</option>
                  </select>
                ) : (
                  <span className="text-sm text-ink">{roleLabel(m.admin_role)}</span>
                ),
            },
            {
              key: "status",
              header: "Status",
              kind: "status",
              cell: (m) =>
                m.account_suspended ? (
                  <span className="text-sm text-amber-800">Suspended</span>
                ) : (
                  <span className="text-sm text-emerald-700">Active</span>
                ),
            },
            ...(canManage
              ? [
                  {
                    key: "actions",
                    header: "Actions",
                    cell: (m: AdminTeamMember) =>
                      user?.id !== m.user_id ? (
                        <AdminTeamMemberActionsMenu
                    memberEmail={m.email}
                    suspended={m.account_suspended}
                    busy={Boolean(rowBusy?.startsWith(m.user_id))}
                    onSendResetLink={async () => {
                      setRowBusy(`${m.user_id}:reset`);
                      try {
                        const result = await sendAdminPasswordResetLink(m.user_id);
                        setSuccessMessage(result.message);
                        showToast({
                          title: "Reset link sent",
                          description: result.message,
                          tone: "success",
                        });
                      } catch (err: unknown) {
                        const message = getApiErrorDetail(err) ?? "Could not send reset link.";
                        setActionError(message);
                        showToast({ title: "Reset link failed", description: message, tone: "error" });
                      } finally {
                        setRowBusy(null);
                      }
                    }}
                    onToggleSuspend={async () => {
                      setRowBusy(m.user_id);
                      try {
                        await patchAdminTeamMember(m.user_id, {
                          account_suspended: !m.account_suspended,
                        });
                        load();
                        showToast({
                          title: m.account_suspended ? "Admin reactivated" : "Admin suspended",
                          tone: "success",
                        });
                      } catch (err: unknown) {
                        const message = getApiErrorDetail(err) ?? "Could not update status.";
                        setActionError(message);
                        showToast({ title: "Status update failed", description: message, tone: "error" });
                      } finally {
                        setRowBusy(null);
                      }
                    }}
                    onDelete={async () => {
                      setRowBusy(`${m.user_id}:delete`);
                      try {
                        const result = await deleteAdminTeamMember(m.user_id);
                        setSuccessMessage(result.message);
                        showToast({
                          title: "Admin removed",
                          description: result.message,
                          tone: "success",
                        });
                        load();
                      } catch (err: unknown) {
                        const message = getApiErrorDetail(err) ?? "Could not delete admin.";
                        setActionError(message);
                        showToast({ title: "Delete failed", description: message, tone: "error" });
                      } finally {
                        setRowBusy(null);
                      }
                    }}
                        />
                      ) : (
                        <span className="text-xs text-ink-3">-</span>
                      ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {members.length > 0 ? (
        <TablePagination
          offset={rosterOffset}
          limit={rosterLimit}
          total={rosterTotal}
          pageRowCount={members.length}
          onPrevious={() => { setActionError(null); goPrevious(); }}
          onNext={() => { setActionError(null); goNext(); }}
        />
      ) : null}

      <Card as="section" className="overflow-hidden">
        <Card.Header>
          <h2 className="ez-h3">What each role can do</h2>
          <p className="ez-small">
            Grant Super admin only when someone needs platform settings, team management, or email health.
          </p>
        </Card.Header>
        <DataTable
          embedded
          aria-label="What each role can do"
          tableClassName="min-w-[28rem]"
          rows={ROLE_CAPABILITY_ROWS}
          getRowKey={(row) => row.area}
          columns={[
            { key: "area", header: "Area", className: "text-sm text-ink", cell: (row) => row.area },
            { key: "admin", header: "Admin", className: "text-sm text-ink-2", cell: (row) => row.admin },
            { key: "superAdmin", header: "Super admin", className: "text-sm text-ink-2", cell: (row) => row.superAdmin },
          ]}
        />
        <p className="border-t border-line px-5 py-4 text-sm text-ink-2">
          Removing an admin keeps their history in the activity log. Sending a password reset link does
          not sign them out.
        </p>
      </Card>
    </div>
  );
}
