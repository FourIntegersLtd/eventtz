"use client";

import type { HTMLAttributes, ReactNode } from "react";

type AdminTableProps = {
  children: ReactNode;
  className?: string;
  /** Drop the outer rounded border when the table sits inside an `ez-card`. */
  embedded?: boolean;
};

export function AdminTable({ children, className = "", embedded = false }: AdminTableProps) {
  return (
    <div
      className={`ez-table-wrap w-full min-w-0 max-w-full ${embedded ? "ez-table-wrap--embedded" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function AdminTableElement({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <table className={`ez-table ${className}`.trim()}>{children}</table>;
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
}

export function AdminTableHeaderCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th scope="col" className={className}>
      {children}
    </th>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function AdminTableRow({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} {...rest}>
      {children}
    </tr>
  );
}

export function AdminTableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={className}>{children}</td>;
}
