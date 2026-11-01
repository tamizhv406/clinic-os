"""Render the manual-testing walkthrough (Markdown subset) to a PDF.

Usage: python guide_to_pdf.py input.md output.pdf

Beyond plain Markdown it understands:
  DO: ...          a step the tester performs            (teal box)
  EXPECT: ...      what the screen should show           (green box)
  NOTE: ...        a tip or warning                      (amber box)
  TRY: ...         something not yet confirmed by the QA run (purple box)
  RESULT:          prints a Works / Problem tick line with space for notes
  ![caption](img)  screenshot, scaled to fit the page
  <<<PAGEBREAK>>>  forces a new page
Level-1 headings start a new page and become PDF bookmarks.
"""
import os
import re
import sys
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, HRFlowable, Image, KeepTogether, ListFlowable, ListItem,
                                PageBreak, PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle)

FONTS = "C:/Windows/Fonts/"
if os.path.exists(FONTS + "arial.ttf"):
    pdfmetrics.registerFont(TTFont("Body", FONTS + "arial.ttf"))
    pdfmetrics.registerFont(TTFont("Body-Bold", FONTS + "arialbd.ttf"))
    pdfmetrics.registerFont(TTFont("Body-Italic", FONTS + "ariali.ttf"))
    pdfmetrics.registerFont(TTFont("Body-BoldItalic", FONTS + "arialbi.ttf"))
    pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold", italic="Body-Italic", boldItalic="Body-BoldItalic")
    BODY, BOLD = "Body", "Body-Bold"
else:  # no rupee sign in the built-in fonts, but everything else still renders
    BODY, BOLD = "Helvetica", "Helvetica-Bold"

TEAL = colors.HexColor("#0f766e")
INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#475569")
PAGE_W = A4[0] - 32 * mm

body = ParagraphStyle("body", fontName=BODY, fontSize=10, leading=14.5, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=8.6, leading=11.5, textColor=MUTED, spaceAfter=0)
cell = ParagraphStyle("cell", parent=body, fontSize=8.8, leading=11.6, spaceAfter=0)
cellhead = ParagraphStyle("cellhead", parent=cell, fontName=BOLD, textColor=colors.white)
box = ParagraphStyle("box", parent=body, fontSize=9.8, leading=13.6, spaceAfter=0)
h1 = ParagraphStyle("h1", parent=body, fontName=BOLD, fontSize=22, leading=27, textColor=TEAL, spaceAfter=8)
h2 = ParagraphStyle("h2", parent=body, fontName=BOLD, fontSize=14.5, leading=19, textColor=TEAL, spaceBefore=14, spaceAfter=6)
h3 = ParagraphStyle("h3", parent=body, fontName=BOLD, fontSize=11.4, leading=15, textColor=INK, spaceBefore=10, spaceAfter=4)
code = ParagraphStyle("code", parent=body, fontName="Courier", fontSize=8.8, leading=12, backColor=colors.HexColor("#f1f5f9"), borderPadding=6, spaceBefore=3, spaceAfter=8)
caption = ParagraphStyle("caption", parent=small, alignment=1, spaceBefore=2, spaceAfter=10)
cover_title = ParagraphStyle("ct", parent=h1, fontSize=30, leading=36)
cover_sub = ParagraphStyle("cs", parent=body, fontSize=13, leading=19, textColor=MUTED)

BOXES = {  # label -> (label background, body background)
    "DO": ("#0f766e", "#ecfdf9"),
    "EXPECT": ("#15803d", "#f0fdf4"),
    "NOTE": ("#b45309", "#fffbeb"),
    "TRY": ("#6d28d9", "#f5f3ff"),
}


def inline(text):
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"`([^`]+)`", r'<font face="Courier" size="9" color="#0f766e">\1</font>', text)
    return text


class Heading(Paragraph):
    """Paragraph that also registers a PDF bookmark."""

    def __init__(self, text, style, level):
        super().__init__(text, style)
        self.level = level
        self.plain = re.sub(r"<[^>]+>", "", text)


class Doc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Heading) and flowable.level <= 2:
            self._bm = getattr(self, "_bm", 0) + 1
            key = "bm%d" % self._bm
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.plain, key, level=flowable.level - 1, closed=flowable.level == 2)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(16 * mm, 9 * mm, "Vernex Clinic OS - Manual Testing Walkthrough")
    canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, "Page %d" % doc.page)
    canvas.restoreState()


def labelled_box(label, text):
    bg_label, bg_body = BOXES[label]
    lab = Paragraph('<font color="white"><b>%s</b></font>' % label, ParagraphStyle("l", parent=box, alignment=1, fontSize=8.6))
    t = Table([[lab, Paragraph(inline(text), box)]], colWidths=[20 * mm, PAGE_W - 20 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor(bg_label)), ("BACKGROUND", (1, 0), (1, 0), colors.HexColor(bg_body)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor(bg_label)),
    ]))
    return [t, Spacer(1, 4)]


def result_line():
    t = Table([[Paragraph("<b>RESULT</b>", cell), Paragraph("[   ] Works as described", cell), Paragraph("[   ] Problem - note it below", cell)],
               [Paragraph("Notes", small), "", ""]],
              colWidths=[20 * mm, 55 * mm, PAGE_W - 75 * mm], rowHeights=[None, 9 * mm])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#94a3b8")), ("LINEBELOW", (0, 0), (-1, 0), 0.3, colors.HexColor("#cbd5e1")),
                           ("SPAN", (1, 1), (2, 1)), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc"))]))
    return [Spacer(1, 2), t, Spacer(1, 10)]


def picture(path, cap, base):
    full = os.path.join(base, path)
    if not os.path.exists(full):
        return [Paragraph("[missing image: %s]" % escape(path), small)]
    w, h = PILImage.open(full).size
    max_w, max_h = PAGE_W * 0.94, 98 * mm
    scale = min(max_w / w, max_h / h)
    img = Image(full, width=w * scale, height=h * scale)
    img.hAlign = "CENTER"
    t = Table([[img]], colWidths=[w * scale + 4])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1")), ("LEFTPADDING", (0, 0), (-1, -1), 1), ("RIGHTPADDING", (0, 0), (-1, -1), 1),
                           ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
    t.hAlign = "CENTER"
    return [KeepTogether([t, Paragraph(inline(cap), caption)])]


def build(src, dst):
    base = os.path.dirname(os.path.abspath(src))
    lines = open(src, encoding="utf8").read().splitlines()
    story, i, first_h1 = [], 0, not any(l.startswith("COVER_TITLE:") for l in lines)
    while i < len(lines):
        line = lines[i]
        if line.strip() == "<<<PAGEBREAK>>>":
            story.append(PageBreak())
        elif line.startswith("```"):
            i += 1
            block = []
            while i < len(lines) and not lines[i].startswith("```"):
                block.append(lines[i]); i += 1
            story.append(Preformatted("\n".join(block), code))
        elif line.strip() == "---":
            story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#cbd5e1"), spaceBefore=4, spaceAfter=4))
        elif line.startswith("# "):
            if not first_h1:
                story.append(PageBreak())
            first_h1 = False
            story.append(Heading(inline(line[2:]), h1, 1))
        elif line.startswith("## "):
            story.append(Heading(inline(line[3:]), h2, 2))
        elif line.startswith("### "):
            story.append(Heading(inline(line[4:]), h3, 3))
        elif line.startswith("COVER_TITLE:"):
            story += [Spacer(1, 55 * mm), Paragraph(inline(line.split(":", 1)[1].strip()), cover_title)]
        elif line.startswith("COVER_SUB:"):
            story.append(Paragraph(inline(line.split(":", 1)[1].strip()), cover_sub))
        elif re.match(r"^(DO|EXPECT|NOTE|TRY):", line):
            label, text = line.split(":", 1)
            story += labelled_box(label, text.strip())
        elif line.strip() == "RESULT:":
            story += result_line()
        elif re.match(r"^!\[.*\]\(.*\)$", line.strip()):
            m = re.match(r"^!\[(.*)\]\((.*)\)$", line.strip())
            story += picture(m.group(2), m.group(1), base)
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
            weights = {2: [1.1, 3.0], 3: [1.3, 2.4, 2.2], 4: [1.5, 2.2, 2.2, 1.0]}.get(ncols, [1.0] * ncols)
            tot = sum(weights)
            table = Table(data, colWidths=[PAGE_W * w / tot for w in weights], repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), TEAL), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
            story += [table, Spacer(1, 8)]
        elif re.match(r"^\s*(\d+\.|-)\s", line):
            ordered = bool(re.match(r"^\s*\d+\.", line))
            items = []
            while i < len(lines) and re.match(r"^\s*(\d+\.|-)\s", lines[i]):
                items.append(ListItem(Paragraph(inline(re.sub(r"^\s*(\d+\.|-)\s", "", lines[i])), body), leftIndent=14))
                i += 1
            i -= 1
            story.append(ListFlowable(items, bulletType="1" if ordered else "bullet", bulletFontSize=8, leftIndent=14, bulletColor=TEAL))
        elif line.strip():
            story.append(Paragraph(inline(line), body))
        i += 1
    doc = Doc(dst, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=15 * mm, bottomMargin=17 * mm,
              title="Vernex Clinic OS - Manual Testing Walkthrough", author="Vernex")
    doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")], onPage=footer)])
    doc.build(story)


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
    print("wrote", sys.argv[2])
