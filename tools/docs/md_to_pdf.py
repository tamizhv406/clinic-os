"""Render a simple Markdown file (headings, paragraphs, lists, tables, code blocks) to PDF.

Usage: python md_to_pdf.py input.md output.pdf
Only the Markdown subset used by docs/INTEGRATION_GUIDE.md is supported.
"""
import re
import sys
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (HRFlowable, ListFlowable, ListItem, Paragraph, Preformatted, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

TEAL = colors.HexColor("#0f766e")
INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#475569")

base = getSampleStyleSheet()
body = ParagraphStyle("body", parent=base["Normal"], fontName="Helvetica", fontSize=9.6, leading=14, textColor=INK, alignment=TA_LEFT, spaceAfter=5)
cell = ParagraphStyle("cell", parent=body, fontSize=8.4, leading=11, spaceAfter=0)
cellhead = ParagraphStyle("cellhead", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)
h1 = ParagraphStyle("h1", parent=body, fontName="Helvetica-Bold", fontSize=21, leading=26, textColor=TEAL, spaceAfter=6)
h2 = ParagraphStyle("h2", parent=body, fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=TEAL, spaceBefore=12, spaceAfter=5)
h3 = ParagraphStyle("h3", parent=body, fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=INK, spaceBefore=8, spaceAfter=3)
code = ParagraphStyle("code", parent=body, fontName="Courier", fontSize=8.2, leading=11, backColor=colors.HexColor("#f1f5f9"), borderPadding=6, spaceBefore=3, spaceAfter=8)
note = ParagraphStyle("note", parent=body, textColor=MUTED, fontSize=8.8, leading=12)


def inline(text: str) -> str:
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"`([^`]+)`", r'<font face="Courier" size="8.6" color="#0f766e">\1</font>', text)
    return text


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 10 * mm, "Vernex Clinic OS - Integration Guide")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build(src: str, dst: str):
    lines = open(src, encoding="utf8").read().splitlines()
    story, i = [], 0
    width = A4[0] - 36 * mm
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            i += 1
            block = []
            while i < len(lines) and not lines[i].startswith("```"):
                block.append(lines[i])
                i += 1
            story.append(Preformatted("\n".join(block), code))
        elif line.strip() == "---":
            story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#cbd5e1"), spaceBefore=4, spaceAfter=4))
        elif line.startswith("# "):
            story.append(Paragraph(inline(line[2:]), h1))
        elif line.startswith("## "):
            story.append(Paragraph(inline(line[3:]), h2))
        elif line.startswith("### "):
            story.append(Paragraph(inline(line[4:]), h3))
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            i -= 1
            ncols = len(rows[0])
            data = [[Paragraph(inline(c), cellhead if r == 0 else cell) for c in row] for r, row in enumerate(rows)]
            weights = [1.0] * ncols
            if ncols == 3:
                weights = [0.9, 2.6, 2.4]
            elif ncols == 2:
                weights = [1.1, 3.0]
            total = sum(weights)
            table = Table(data, colWidths=[width * w / total for w in weights], repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), TEAL),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story += [table, Spacer(1, 8)]
        elif re.match(r"^\s*(\d+\.|-)\s", line):
            ordered = bool(re.match(r"^\s*\d+\.", line))
            items = []
            while i < len(lines) and re.match(r"^\s*(\d+\.|-)\s", lines[i]):
                items.append(ListItem(Paragraph(inline(re.sub(r"^\s*(\d+\.|-)\s", "", lines[i])), body), leftIndent=14))
                i += 1
            i -= 1
            story.append(ListFlowable(items, bulletType="1" if ordered else "bullet", bulletFontSize=8, leftIndent=14, bulletColor=TEAL))
        elif line.strip().startswith("*") and line.strip().endswith("*") and not line.strip().startswith("**"):
            story.append(Paragraph(inline(line.strip()), note))
        elif line.strip():
            story.append(Paragraph(inline(line), body))
        i += 1
    doc = SimpleDocTemplate(dst, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                            title="Vernex Clinic OS - Integration Guide", author="Vernex")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
    print("wrote", sys.argv[2])
