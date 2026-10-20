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
      className="ez-icon-btn ez-icon-btn--outline shrink-0"
      onClick={() => void onCopy()}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
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
    <div className="ez-lines">
      <p className="ez-strong">{account.role}</p>
      <div className="ez-hrow">
        <p className="min-w-0 flex-1 truncate ez-small" title={account.email}>{account.email}</p>
        <CopyFieldButton
          label={`${account.role} email`}
          copied={copied === "email"}
          onCopy={() => void copy("email", account.email)}
        />
      </div>
      <div className="ez-hrow">
        <p className="min-w-0 flex-1 font-mono text-sm tracking-wider ez-caption" aria-hidden>
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
    <section className="ez-card overflow-hidden">
      <div className="ez-card__head">
        <h2 className="ez-h3">Test accounts</h2>
        <p className="ez-small">
          Vendor and client QA sign-ins. Passwords stay hidden; use copy.
        </p>
      </div>
      <div className="ez-card__body ez-stack ez-stack--lg">
        {ADMIN_TEST_ACCOUNTS.map((account) => (
          <TestAccountRow key={account.email} account={account} />
        ))}
      </div>
    </section>
  );
}
