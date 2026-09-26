"""Seed and inspect api/'s local Postgres with the same calls the tests make on Supabase.

The freeze tests reach the database through supabase-py's query builder
(`admin_db.table("users").select("email").eq("id", user_id).execute().data`).
Against `TARGET=api` there is no PostgREST, so `LocalDatabase` answers the same
small subset of that builder with SQL over psycopg. The tests stay byte-identical
across targets, which is the point of a freeze suite.

Only what the tests use is supported: `select`/`insert`/`update`/`delete` with
`eq`, `in_`, `order` and `limit`, plus `auth.admin.delete_user`. Rows come back
in PostgREST's JSON shape (UUIDs and timestamps as text, numerics as floats).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

# Postgres types whose values are JSON documents rather than scalars or arrays.
JSON_TYPES = {"json", "jsonb"}


def plain_value(value: Any) -> Any:
    """One column value as PostgREST would have sent it in JSON."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


@dataclass
class QueryResult:
    """What `execute()` returns: the affected or selected rows, like supabase-py's `APIResponse`."""

    data: list[dict[str, Any]]


@dataclass
class TableQuery:
    """One statement against one table, built up by chained calls and run by `execute()`."""

    database: LocalDatabase
    table_name: str
    statement: str = "select"
    selected_columns: list[str] = field(default_factory=lambda: ["*"])
    values: list[dict[str, Any]] = field(default_factory=list)
    filters: list[tuple[str, str, Any]] = field(default_factory=list)
    ordering: list[tuple[str, bool]] = field(default_factory=list)
    row_limit: int | None = None

    def select(self, columns: str = "*") -> TableQuery:
        """Read these comma-separated columns (`"*"` for all)."""
        self.statement = "select"
        self.selected_columns = [column.strip() for column in columns.split(",") if column.strip()]
        return self

    def insert(self, rows: dict[str, Any] | list[dict[str, Any]]) -> TableQuery:
        """Insert one row or several; the stored rows come back."""
        self.statement = "insert"
        self.values = rows if isinstance(rows, list) else [rows]
        return self

    def update(self, changes: dict[str, Any]) -> TableQuery:
        """Set these columns on every row the filters match."""
        self.statement = "update"
        self.values = [changes]
        return self

    def delete(self) -> TableQuery:
        """Delete every row the filters match."""
        self.statement = "delete"
        return self

    def eq(self, column: str, value: Any) -> TableQuery:
        """Keep rows where `column` equals `value`."""
        self.filters.append((column, "eq", value))
        return self

    def in_(self, column: str, values: list[Any]) -> TableQuery:
        """Keep rows where `column` is one of `values`."""
        self.filters.append((column, "in", list(values)))
        return self

    def order(self, column: str, *, desc: bool = False) -> TableQuery:
        """Sort by `column`, ascending unless `desc`."""
        self.ordering.append((column, desc))
        return self

    def limit(self, count: int) -> TableQuery:
        """Return at most `count` rows."""
        self.row_limit = count
        return self

    def execute(self) -> QueryResult:
        """Run the statement and return the rows it selected or touched."""
        column_types = self.database.column_types(self.table_name)
        query, parameters = self._compose(column_types)
        with self.database.connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, parameters)
            rows = cursor.fetchall() if cursor.description else []
        return QueryResult(data=[{name: plain_value(value) for name, value in row.items()} for row in rows])

    def _typed_placeholder(self, column: str, column_types: dict[str, str]) -> sql.Composable:
        """`%s::type` for the column, so text ids, ISO timestamps and enums reach Postgres typed."""
        return sql.SQL("%s::") + sql.SQL(column_types[column])

    def _adapt(self, column: str, value: Any, column_types: dict[str, str]) -> Any:
        """Wrap JSON column values so psycopg sends a document, not an array or a string."""
        return Jsonb(value) if column_types[column] in JSON_TYPES and value is not None else value

    def _compose(self, column_types: dict[str, str]) -> tuple[sql.Composable, list[Any]]:
        """The SQL text and its parameters for this statement."""
        table = sql.Identifier(self.table_name)
        parameters: list[Any] = []
        if self.statement == "insert":
            columns = list(self.values[0])
            rows_sql = []
            for row in self.values:
                rows_sql.append(
                    sql.SQL("({})").format(
                        sql.SQL(", ").join(
                            self._typed_placeholder(column, column_types) for column in columns
                        )
                    )
                )
                parameters += [self._adapt(column, row[column], column_types) for column in columns]
            query = sql.SQL("insert into {} ({}) values {} returning *").format(
                table, sql.SQL(", ").join(map(sql.Identifier, columns)), sql.SQL(", ").join(rows_sql)
            )
            return query, parameters
        if self.statement == "update":
            changes = self.values[0]
            assignments = sql.SQL(", ").join(
                sql.SQL("{} = ").format(sql.Identifier(column))
                + self._typed_placeholder(column, column_types)
                for column in changes
            )
            parameters += [self._adapt(column, value, column_types) for column, value in changes.items()]
            query = sql.SQL("update {} set {}").format(table, assignments)
        elif self.statement == "delete":
            query = sql.SQL("delete from {}").format(table)
        else:
            selected = (
                sql.SQL("*")
                if self.selected_columns == ["*"]
                else sql.SQL(", ").join(map(sql.Identifier, self.selected_columns))
            )
            query = sql.SQL("select {} from {}").format(selected, table)
        if self.filters:
            conditions = []
            for column, operator, value in self.filters:
                if operator == "in":
                    conditions.append(
                        sql.SQL("{} = any(%s::{}[])").format(
                            sql.Identifier(column), sql.SQL(column_types[column])
                        )
                    )
                else:
                    conditions.append(
                        sql.SQL("{} = ").format(sql.Identifier(column))
                        + self._typed_placeholder(column, column_types)
                    )
                parameters.append(value)
            query += sql.SQL(" where ") + sql.SQL(" and ").join(conditions)
        if self.statement != "select":
            return query + sql.SQL(" returning *"), parameters
        if self.ordering:
            query += sql.SQL(" order by ") + sql.SQL(", ").join(
                sql.SQL("{} {}").format(sql.Identifier(column), sql.SQL("desc" if descending else "asc"))
                for column, descending in self.ordering
            )
        if self.row_limit is not None:
            query += sql.SQL(" limit %s")
            parameters.append(self.row_limit)
        return query, parameters


class AuthAdmin:
    """The one Supabase Auth admin call the tests make: deleting a user they created."""

    def __init__(self, database: LocalDatabase) -> None:
        """Bind to the database the account lives in."""
        self.database = database

    def delete_user(self, user_id: str) -> None:
        """Delete the account row; foreign keys cascade exactly as they did from `auth.users`."""
        self.database.table("users").delete().eq("id", user_id).execute()


@dataclass
class Auth:
    """`admin_db.auth`, holding the admin API."""

    admin: AuthAdmin


class LocalDatabase:
    """api/'s local Postgres behind the slice of supabase-py's client the tests use."""

    def __init__(self, database_url: str) -> None:
        """Open one autocommit connection, as each PostgREST call commits on its own."""
        self.connection = psycopg.connect(database_url, autocommit=True, options="-c timezone=UTC")
        self.auth = Auth(admin=AuthAdmin(self))
        self._column_types: dict[str, dict[str, str]] = {}

    def table(self, table_name: str) -> TableQuery:
        """Start a statement against `table_name`."""
        return TableQuery(database=self, table_name=table_name)

    def column_types(self, table_name: str) -> dict[str, str]:
        """`{column: postgres type}` for a public table (arrays as `type[]`), cached per table."""
        if table_name not in self._column_types:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "select column_name, udt_name from information_schema.columns "
                    "where table_schema = 'public' and table_name = %s",
                    (table_name,),
                )
                self._column_types[table_name] = {
                    column: f"{udt[1:]}[]" if udt.startswith("_") else udt
                    for column, udt in cursor.fetchall()
                }
        return self._column_types[table_name]
