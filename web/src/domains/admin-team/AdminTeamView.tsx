"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminMemberRoleLabel } from "@/domains/admin-team/adminMemberRoleLabel";
import { Button, TextField } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  AdminSuccessBanner,
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
  adminCapabilities,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import {
  deleteAdminTeamMember,
  fetchAdminTeam,
  inviteAdminColleague,
  patchAdminTeamMember,
  sendAdminPasswordResetLink,
  type AdminTeamMember,
} from "@/domains/admin-team/api";

/**
 * `/admin/team` — the admin colleague roster.
 *
 * Super admins can invite colleagues, change roles, suspend and remove them;
 * a plain admin gets a read-only view, matching `frontend/features/admin/team/AdminTeamView.tsx`.
 */
export function AdminTeamView() {
  const { session } = useSession();
  const superAdmin = adminCapabilities.canManageAdminTeam(session);
  const selfUserId = session?.user.id;

  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const rows = await fetchAdminTeam();
      if (mySeq !== requestSeq.current) return;
      setMembers(rows);
    } catch (cause) {
      if (mySeq !== requestSeq.current) return;
      setError(isPlatformError(cause) ? cause.detail : "Could not load the admin team.");
    } finally {
      if (mySeq !== requestSeq.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleInvite() {
    setInviteBusy(true);
    setInviteError(null);
    try {
      await inviteAdminColleague(inviteEmail);
      setInviteEmail("");
      setShowInvite(false);
      setNotice("Admin account created");
      await load();
    } catch (cause) {
      setInviteError(isPlatformError(cause) ? cause.detail : "Could not create the admin account.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRoleChange(userId: string, role: "super_admin" | "admin") {
    setNotice(null);
    try {
      await patchAdminTeamMember(userId, { admin_role: role });
      setNotice("Role updated");
      await load();
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not update role.");
    }
  }

  async function handleSuspendToggle(member: AdminTeamMember) {
    setNotice(null);
    try {
      await patchAdminTeamMember(member.user_id, { account_suspended: !member.account_suspended });
      setNotice(member.account_suspended ? "Admin reactivated" : "Admin suspended");
      await load();
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not update status.");
    }
  }

  async function handleResetLink(userId: string) {
    setNotice(null);
    try {
      await sendAdminPasswordResetLink(userId);
      setNotice("Reset link sent");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not send reset link.");
    }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm("Remove this admin? They will be demoted to a client account.")) return;
    setNotice(null);
    try {
      await deleteAdminTeamMember(userId);
      setNotice("Admin removed");
      await load();
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not remove admin.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          {superAdmin
            ? "Admin colleagues who can access the console. Super admins can create accounts and manage roles."
            : "Contact a super admin to add admins or change roles."}
        </p>
        {superAdmin ? (
          <Button onClick={() => setShowInvite((value) => !value)}>Create admin account</Button>
        ) : null}
      </div>

      {showInvite ? (
        <div className="max-w-sm space-y-3 rounded-2xl border border-primary-border bg-white p-4">
          <TextField
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
          />
          {inviteError ? <AdminErrorBanner message={inviteError} /> : null}
          <Button loading={inviteBusy} onClick={() => void handleInvite()} disabled={!inviteEmail}>
            Send
          </Button>
        </div>
      ) : null}

      {notice ? <AdminSuccessBanner message={notice} /> : null}
      {loading ? <AdminLoadingState label="Loading admin team…" /> : null}
      {!loading && error ? <AdminErrorBanner message={error} /> : null}
      {!loading && !error && members.length === 0 ? <AdminEmptyState title="No admins yet" /> : null}
      {!loading && !error && members.length > 0 ? (
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell>Email</AdminTableHeaderCell>
              <AdminTableHeaderCell>Role</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              {superAdmin ? <AdminTableHeaderCell>Actions</AdminTableHeaderCell> : null}
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {members.map((member) => {
              const isSelf = member.user_id === selfUserId;
              return (
                <AdminTableRow key={member.user_id}>
                  <AdminTableCell>
                    {member.email ?? "-"}
                    {isSelf ? " (you)" : ""}
                  </AdminTableCell>
                  <AdminTableCell>
                    {superAdmin && !isSelf ? (
                      <select
                        value={member.admin_role}
                        onChange={(event) =>
                          void handleRoleChange(member.user_id, event.target.value as "super_admin" | "admin")
                        }
                        className="rounded-lg border border-primary-border px-2 py-1 text-sm"
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super admin</option>
                      </select>
                    ) : (
                      adminMemberRoleLabel(member.admin_role)
                    )}
                  </AdminTableCell>
                  <AdminTableCell>{member.account_suspended ? "Suspended" : "Active"}</AdminTableCell>
                  {superAdmin ? (
                    <AdminTableCell>
                      {isSelf ? (
                        "-"
                      ) : (
                        <div className="flex flex-wrap gap-2 text-xs">
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => void handleResetLink(member.user_id)}
                          >
                            Send reset link
                          </button>
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => void handleSuspendToggle(member)}
                          >
                            {member.account_suspended ? "Reactivate" : "Suspend"}
                          </button>
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() => void handleDelete(member.user_id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </AdminTableCell>
                  ) : null}
                </AdminTableRow>
              );
            })}
          </AdminTableBody>
        </AdminTable>
      ) : null}
    </div>
  );
}
