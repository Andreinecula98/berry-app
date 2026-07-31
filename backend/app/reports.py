"""Report generation helpers for admin exports (Excel and PDF)."""
import io
from typing import Sequence

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from .models import Submission

STATUS_LABELS_RO = {
    "pending": "In asteptare",
    "approved": "Aprobat",
    "rejected": "Respins",
}

HEADERS = ["Angajat", "Var1", "Var2", "Var3", "Average Berry Weight", "Status", "Data trimiterii", "Verificat de"]


def _row_for(sub: Submission) -> list:
    return [
        sub.employee.full_name or sub.employee.username,
        sub.var1,
        sub.var2,
        sub.var3,
        round(sub.average_berry_weight, 2),
        STATUS_LABELS_RO.get(sub.status.value if hasattr(sub.status, "value") else sub.status, sub.status),
        sub.created_at.strftime("%Y-%m-%d %H:%M") if sub.created_at else "",
        (sub.reviewed_by.full_name or sub.reviewed_by.username) if sub.reviewed_by else "-",
    ]


def build_excel_report(submissions: Sequence[Submission]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Raport Berry Weight"

    ws.append(HEADERS)
    header_fill = PatternFill(start_color="6A1B9A", end_color="6A1B9A", fill_type="solid")
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for sub in submissions:
        ws.append(_row_for(sub))

    widths = [22, 10, 10, 10, 22, 16, 18, 20]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def build_pdf_report(submissions: Sequence[Submission]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    elements = [Paragraph("Raport Berry Weight App", styles["Title"]), Spacer(1, 0.5 * cm)]

    data = [HEADERS] + [_row_for(sub) for sub in submissions]
    if len(data) == 1:
        data.append(["-"] * len(HEADERS))

    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6A1B9A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f8")]),
                ("ALIGN", (1, 0), (4, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    elements.append(table)
    doc.build(elements)
    return buffer.getvalue()
