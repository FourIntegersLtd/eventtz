"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { AdminCreateAdminModal } from "@/features/admin/team/AdminCreateAdminModal";
import {
  fetchAdminTeam,
  isSuperAdmin,
  patchAdminTeamMember,
  type AdminTeamMember,
} from "@/lib/adminTeamApi";
import { getApiErrorDetail } from "@/lib/api-errors";

function roleLabel(role: AdminTeamMember["admin_role"]): string {
  return role === "super_admin" ? "Super admin" : "Admin";
}

export function AdminTeamView() {
  const { user } = useAuth();
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const canManage = isSuperAdmin(user);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await fetchAdminTeam();
      setMembers(list);
    } catch {
      setError("Could not load admin team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <AdminLoadingState label="Loading team…" />;
  }

  return (
    <div className="space-y-6">
      {error ? <AdminErrorBanner message={error} /> : null}
      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      <AdminPageHeader
        subtitle={
          canManage
            ? "Admin colleagues who can access the console. Super admins can create accounts and manage roles."
            : "Colleagues on the admin team. Contact a super admin to add admins or change roles."
        }
        actions={
          canManage ? (
            <Button
              icon={<UserPlus className="h-4 w-4" aria-hidden />}
              onClick={() => setCreateOpen(true)}
            >
              Create admin account
            </Button>
          ) : null
        }
      />

      <AdminCreateAdminModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(message) => {
          setSuccessMessage(message);
          void load();
        }}
      />

      {members.length === 0 ? (
        <EmptyState title="No admins yet" />
      ) : (
        <AdminTable>
          <AdminTableElement>
            <AdminTableHead>
              <AdminTableHeaderCell>Email</AdminTableHeaderCell>
              <AdminTableHeaderCell>Role</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              {canManage ? (
                <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
              ) : null}
            </AdminTableHead>
            <AdminTableBody>
              {members.map((m) => {
                const isSelf = user?.id === m.user_id;
                return (
                  <AdminTableRow key={m.user_id}>
                    <AdminTableCell className="font-medium text-neutral-900">
                      {m.email ?? "—"}
                      {isSelf ? (
                        <span className="ml-2 text-xs font-normal text-neutral-500">(you)</span>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell>
                      {canManage && !isSelf ? (
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
                              } catch (err: unknown) {
                                setError(getApiErrorDetail(err) ?? "Could not update role.");
                              } finally {
                                setRowBusy(null);
                              }
                            })();
                          }}
                          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super admin</option>
                        </select>
                      ) : (
                        <span className="text-sm text-neutral-800">{roleLabel(m.admin_role)}</span>
                      )}
                    </AdminTableCell>
                    <AdminTableCell>
                      {m.account_suspended ? (
                        <span className="text-sm text-amber-800">Suspended</span>
                      ) : (
                        <span className="text-sm text-emerald-700">Active</span>
                      )}
                    </AdminTableCell>
                    {canManage ? (
                      <AdminTableCell className="text-right">
                        {!isSelf ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={rowBusy === m.user_id}
                            onClick={() => {
                              void (async () => {
                                setRowBusy(m.user_id);
                                try {
                                  await patchAdminTeamMember(m.user_id, {
                                    account_suspended: !m.account_suspended,
                                  });
                                  await load();
                                } catch (err: unknown) {
                                  setError(getApiErrorDetail(err) ?? "Could not update status.");
                                } finally {
                                  setRowBusy(null);
                                }
                              })();
                            }}
                          >
                            {m.account_suspended ? "Reactivate" : "Suspend"}
                          </Button>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </AdminTableCell>
                    ) : null}
                  </AdminTableRow>
                );
              })}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
      )}
    </div>
  );
}
