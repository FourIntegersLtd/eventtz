#!/usr/bin/env python3
"""Generate docs/eventtz-architecture-guide.pdf from the markdown source."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[2]
MD_PATH = ROOT / "docs" / "eventtz-architecture-guide.md"
PDF_PATH = ROOT / "docs" / "eventtz-architecture-guide.pdf"


class ArchGuidePDF(FPDF):
    def header(self) -> None:
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(0, 8, "Eventtz Architecture Guide", align="R")
            self.ln(4)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")


def _clean_md_inline(text: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2192", "->")
        .replace("\u2026", "...")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    return text.strip()


def _ascii_safe(text: str) -> str:
    return _clean_md_inline(text).encode("ascii", "replace").decode("ascii")


def _w(pdf: FPDF) -> float:
    return pdf.epw


def build_pdf(md_text: str, out_path: Path) -> None:
    pdf = ArchGuidePDF()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    pdf.set_margins(18, 18, 18)

    in_code = False
    lines = md_text.splitlines()

    for raw in lines:
        line = raw.rstrip()
        pdf.set_x(pdf.l_margin)

        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            pdf.set_font("Courier", "", 8)
            pdf.set_text_color(40, 40, 40)
            pdf.multi_cell(_w(pdf), 4.5, _ascii_safe(line.replace("\t", "    ")))
            pdf.ln(1)
            continue

        if not line.strip():
            pdf.ln(3)
            continue

        if line.strip() == "---":
            pdf.ln(2)
            pdf.set_draw_color(200, 200, 200)
            pdf.line(18, pdf.get_y(), pdf.w - 18, pdf.get_y())
            pdf.ln(4)
            continue

        if line.startswith("# "):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 20)
            pdf.set_text_color(30, 30, 30)
            pdf.multi_cell(_w(pdf), 10, _ascii_safe(line[2:]))
            pdf.ln(2)
            continue

        if line.startswith("## "):
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(50, 50, 50)
            pdf.multi_cell(_w(pdf), 8, _ascii_safe(line[3:]))
            pdf.ln(1)
            continue

        if line.startswith("### "):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(60, 60, 60)
            pdf.multi_cell(_w(pdf), 6, _ascii_safe(line[4:]))
            pdf.ln(1)
            continue

        if line.startswith("|") and "|" in line[1:]:
            # Table row — render as monospace row
            cells = [c.strip() for c in line.strip("|").split("|")]
            row = "  |  ".join(_ascii_safe(c) for c in cells)
            if all(set(c) <= {"-", " "} for c in cells):
                continue  # separator row
            pdf.set_font("Courier", "", 8)
            pdf.set_text_color(30, 30, 30)
            pdf.multi_cell(_w(pdf), 4.5, row)
            continue

        if line.startswith("- "):
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(30, 30, 30)
            pdf.multi_cell(_w(pdf), 5.5, f"  -  {_ascii_safe(line[2:])}")
            continue

        if re.match(r"^\d+\.\s", line):
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(30, 30, 30)
            pdf.multi_cell(_w(pdf), 5.5, f"  { _ascii_safe(line)}")
            continue

        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(_w(pdf), 5.5, _ascii_safe(line))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(out_path))


def main() -> int:
    if not MD_PATH.is_file():
        print(f"Missing source: {MD_PATH}", file=sys.stderr)
        return 1
    md_text = MD_PATH.read_text(encoding="utf-8")
    build_pdf(md_text, PDF_PATH)
    print(f"Wrote {PDF_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
