"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { DataTable } from "@/components/ui/DataTable";
import { AdminSuccessBanner } from "@/features/admin/components/AdminSuccessBanner";
import { AdminCreateAdminModal } from "@/features/admin/team/AdminCreateAdminModal";
import { AdminTeamMemberActionsMenu } from "@/features/admin/team/AdminTeamMemberActionsMenu";
import {
  ADMIN_TEAM_PAGE_SIZE,
  fetchAdminTeamPage,
  isSuperAdmin,
  patchAdminTeamMember,
  sendAdminPasswordResetLink,
  deleteAdminTeamMember,
  type AdminTeamMember,
} from "@/lib/adminTeamApi";
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
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rosterOffset, setRosterOffset] = useState(0);

  const canManage = isSuperAdmin(user);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const page = await fetchAdminTeamPage(rosterOffset, ADMIN_TEAM_PAGE_SIZE);
      setMembers(page.members);
      setRosterTotal(page.total);
    } catch {
      setError("Could not load admin team.");
    } finally {
      setLoading(false);
    }
  }, [rosterOffset]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
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
          void load();
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
              className: "font-medium text-neutral-900",
              cell: (m) => (
                <>
                  {m.email ?? "-"}
                  {user?.id === m.user_id ? (
                    <span className="ml-2 text-xs font-normal text-neutral-500">(you)</span>
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
                        await load();
                        showToast({
                          title: "Role updated",
                          description: roleLabel(next),
                          tone: "success",
                        });
                      } catch (err: unknown) {
                        const message = getApiErrorDetail(err) ?? "Could not update role.";
                        setError(message);
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
                  <span className="text-sm text-neutral-800">{roleLabel(m.admin_role)}</span>
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
                        setError(message);
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
                        await load();
                        showToast({
                          title: m.account_suspended ? "Admin reactivated" : "Admin suspended",
                          tone: "success",
                        });
                      } catch (err: unknown) {
                        const message = getApiErrorDetail(err) ?? "Could not update status.";
                        setError(message);
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
                        await load();
                      } catch (err: unknown) {
                        const message = getApiErrorDetail(err) ?? "Could not delete admin.";
                        setError(message);
                        showToast({ title: "Delete failed", description: message, tone: "error" });
                      } finally {
                        setRowBusy(null);
                      }
                    }}
                        />
                      ) : (
                        <span className="text-xs text-neutral-400">-</span>
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
          limit={ADMIN_TEAM_PAGE_SIZE}
          total={rosterTotal}
          pageRowCount={members.length}
          onPrevious={() => setRosterOffset((current) => Math.max(0, current - ADMIN_TEAM_PAGE_SIZE))}
          onNext={() => setRosterOffset((current) => current + ADMIN_TEAM_PAGE_SIZE)}
        />
      ) : null}

      <section className="ez-card overflow-hidden">
        <div className="ez-card__head">
          <h2 className="ez-h3">What each role can do</h2>
          <p className="ez-small">
            Grant Super admin only when someone needs platform settings, team management, or email health.
          </p>
        </div>
        <DataTable
          embedded
          aria-label="What each role can do"
          tableClassName="min-w-[28rem]"
          rows={ROLE_CAPABILITY_ROWS}
          getRowKey={(row) => row.area}
          columns={[
            { key: "area", header: "Area", className: "text-sm text-neutral-800", cell: (row) => row.area },
            { key: "admin", header: "Admin", className: "text-sm text-neutral-700", cell: (row) => row.admin },
            { key: "superAdmin", header: "Super admin", className: "text-sm text-neutral-700", cell: (row) => row.superAdmin },
          ]}
        />
        <p className="border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
          Removing an admin keeps their history in the activity log. Sending a password reset link does
          not sign them out.
        </p>
      </section>
    </div>
  );
}
