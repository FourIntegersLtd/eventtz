import type { ReactNode } from "react";

/** How a column's cells are set: `strong` for the row's name, `num` for figures, `status` for badges. */
export type DataTableCellKind = "strong" | "num" | "status";

export type DataTableColumn<Row> = {
  /** Stable key, also the React key of the header cell. */
  key: string;
  header: ReactNode;
  /** Renders the cell for one row. */
  cell: (row: Row) => ReactNode;
  kind?: DataTableCellKind;
};

export type DataTableProps<Row> = {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /** Stable identity of a row (an id, never the index). */
  getRowKey: (row: Row) => string;
  /** Makes each row clickable; the handler gets the row. */
  onRowClick?: (row: Row) => void;
  /** Drop the outer rounded border when the table sits inside an `ez-card`. */
  embedded?: boolean;
  /** Accessible name of the table. */
  "aria-label": string;
  className?: string;
};

const CELL_KIND_CLASSES: Record<DataTableCellKind, string> = {
  strong: "ez-td-strong",
  num: "ez-td-num",
  status: "ez-td-status",
};

/**
 * Canvas data table (`ez-table-wrap` > `ez-table`) driven by column definitions.
 * Pair it with `TablePagination` for offset/limit lists; it renders no empty state,
 * the caller shows `EmptyState` instead when there are no rows.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  embedded = false,
  className = "",
  ...aria
}: DataTableProps<Row>) {
  return (
    <div className={`ez-table-wrap${embedded ? " ez-table-wrap--embedded" : ""} ${className}`.trim()}>
      <table className="ez-table" aria-label={aria["aria-label"]}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.kind === "status" ? CELL_KIND_CLASSES.status : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.kind ? CELL_KIND_CLASSES[column.kind] : undefined}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
