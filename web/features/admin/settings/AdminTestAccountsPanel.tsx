"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/copyToClipboard";
import { ADMIN_TEST_ACCOUNTS, type AdminTestAccount } from "@/features/admin/settings/adminTestAccounts";

type CopyKind = "email" | "password";

function CopyFieldButton({
  label,
  copied,
  onCopy,
}: {
  label: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      onClick={() => void onCopy()}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

function TestAccountRow({ account }: { account: AdminTestAccount }) {
  const [copied, setCopied] = useState<CopyKind | null>(null);

  const copy = async (kind: CopyKind, text: string) => {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="text-[13px] font-semibold text-neutral-900">{account.role}</p>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm text-neutral-800" title={account.email}>
          {account.email}
        </p>
        <CopyFieldButton
          label={`${account.role} email`}
          copied={copied === "email"}
          onCopy={() => void copy("email", account.email)}
        />
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 font-mono text-sm tracking-wider text-neutral-400" aria-hidden>
          ••••••••
        </p>
        <span className="sr-only">{account.role} password hidden</span>
        <CopyFieldButton
          label={`${account.role} password`}
          copied={copied === "password"}
          onCopy={() => void copy("password", account.password)}
        />
      </div>
    </div>
  );
}

export function AdminTestAccountsPanel() {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Test accounts</h2>
        <p className="mt-0.5 text-[13px] text-neutral-400">
          Sign in as these vendor and client accounts to QA the product. Passwords stay hidden; use
          copy.
        </p>
      </div>
      <div className="divide-y divide-neutral-100 border-t border-neutral-100">
        {ADMIN_TEST_ACCOUNTS.map((account) => (
          <TestAccountRow key={account.email} account={account} />
        ))}
      </div>
    </section>
  );
}
