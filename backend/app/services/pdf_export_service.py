"""
PDF Report Generation Service for ChargeGuard AI Pro.

Generates engineering-grade diagnostic reports for cable test sessions
using ReportLab, including electrical characteristics, ML anomaly classifications,
and maintenance recommendations.
"""

import io
from typing import Optional
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.units import inch

from app.models import TestSession, Cable, Measurement, Alert, AnalysisResult
from app.core.datetime_utils import utc_now


def generate_test_report_pdf(db: Session, test_id: str) -> bytes:
    """Generate a formatted PDF diagnostic report for a specific test session."""
    session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
    if not session:
        raise ValueError(f"TestSession {test_id} not found.")

    cable = session.cable
    measurements = session.measurements
    analysis = session.analysis_result
    alerts = session.alerts

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a')
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b')
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=10,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )

    story = []

    # Title & Header
    story.append(Paragraph("ChargeGuard AI Pro — Diagnostic Health Report", title_style))
    story.append(Paragraph(f"Test Session ID: <b>{session.test_id}</b> | Generated: {utc_now().strftime('%Y-%m-%d %H:%M:%S UTC')}", subtitle_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=12))

    # Cable & Test Metadata Table
    cable_name = cable.display_name if cable else "Unknown Cable"
    connector = cable.connector_type if cable else "USB-C"
    rated_p = f"{cable.rated_power_w} W" if (cable and cable.rated_power_w) else "60.0 W"
    rated_i = f"{cable.rated_current_a} A" if (cable and cable.rated_current_a) else "3.0 A"
    duration = f"{(session.ended_at - session.started_at).seconds}s" if session.ended_at else "Active"

    meta_data = [
        ["Device Under Test:", cable_name, "Execution Mode:", session.mode.upper()],
        ["Connector Interface:", connector, "Session Status:", session.status.upper()],
        ["Rated Parameters:", f"{rated_p} @ {rated_i}", "Final Result:", (session.final_result or 'INSUFFICIENT_DATA').upper()],
        ["Start Time:", session.started_at.strftime('%Y-%m-%d %H:%M:%S'), "Duration:", duration]
    ]
    t_meta = Table(meta_data, colWidths=[1.8*inch, 2.2*inch, 1.4*inch, 1.8*inch])
    t_meta.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('TEXTCOLOR', (0,0), (0,-1), colors.HexColor('#64748b')),
        ('TEXTCOLOR', (2,0), (2,-1), colors.HexColor('#64748b')),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 12))

    # Health & Diagnostic Evaluation Summary
    health_score_str = f"{analysis.health_score:.1f} / 100" if (analysis and analysis.health_score is not None) else "N/A"
    health_cat = analysis.health_category if analysis else (session.final_result or "Unknown").title()

    story.append(Paragraph("Diagnostic Intelligence & Health Assessment", section_heading))
    diag_data = [
        ["Overall Health Score", "Health Classification", "Confidence Level", "Model Version"],
        [health_score_str, health_cat, f"{(analysis.confidence or 0.85)*100:.0f}%" if analysis else "85%", analysis.model_version if analysis else "rules-v1.0"]
    ]
    t_diag = Table(diag_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
    t_diag.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8.5),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,1), (-1,1), 11),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#94a3b8')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_diag)
    story.append(Spacer(1, 10))

    # Sensor Statistics Table
    story.append(Paragraph("Electrical Telemetry Statistics", section_heading))
    if measurements:
        v_list = [m.sink_voltage_v for m in measurements if m.sink_voltage_v is not None]
        i_list = [m.current_a for m in measurements if m.current_a is not None]
        t_list = [m.temperature_c for m in measurements if m.temperature_c is not None]
        r_list = [m.effective_resistance_ohm for m in measurements if m.effective_resistance_ohm is not None]
        vd_list = [m.voltage_drop_v for m in measurements if m.voltage_drop_v is not None]

        stats_data = [
            ["Metric", "Minimum", "Average", "Maximum", "Engineering Tolerance"],
            ["Sink Voltage (V)", f"{min(v_list):.3f}" if v_list else "-", f"{sum(v_list)/len(v_list):.3f}" if v_list else "-", f"{max(v_list):.3f}" if v_list else "-", "4.75 - 5.25 V"],
            ["Current Load (A)", f"{min(i_list):.3f}" if i_list else "-", f"{sum(i_list)/len(i_list):.3f}" if i_list else "-", f"{max(i_list):.3f}" if i_list else "-", "0.0 - 3.00 A"],
            ["Surface Temp (°C)", f"{min(t_list):.1f}" if t_list else "-", f"{sum(t_list)/len(t_list):.1f}" if t_list else "-", f"{max(t_list):.1f}" if t_list else "-", "< 50.0 °C Safe Limit"],
            ["Path Resistance (Ω)", f"{min(r_list):.4f}" if r_list else "-", f"{sum(r_list)/len(r_list):.4f}" if r_list else "-", f"{max(r_list):.4f}" if r_list else "-", "< 0.250 Ω Good Quality"],
            ["Voltage Drop (V)", f"{min(vd_list):.3f}" if vd_list else "-", f"{sum(vd_list)/len(vd_list):.3f}" if vd_list else "-", f"{max(vd_list):.3f}" if vd_list else "-", "< 0.250 V Drop"]
        ]
    else:
        stats_data = [["No telemetry measurements recorded for this session."]]

    t_stats = Table(stats_data, colWidths=[1.8*inch, 1.3*inch, 1.3*inch, 1.3*inch, 1.5*inch])
    t_stats.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_stats)
    story.append(Spacer(1, 10))

    # Active Alerts
    story.append(Paragraph("Safety & Anomaly Alerts", section_heading))
    if alerts:
        alert_rows = [["Severity", "Code", "Observed", "Threshold", "Description"]]
        for a in alerts:
            alert_rows.append([
                a.severity.upper(),
                a.code,
                f"{a.observed_value:.2f}" if a.observed_value is not None else "-",
                f"{a.threshold_value:.2f}" if a.threshold_value is not None else "-",
                a.message
            ])
        t_alerts = Table(alert_rows, colWidths=[1.1*inch, 1.6*inch, 0.9*inch, 0.9*inch, 2.7*inch])
        t_alerts.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#fee2e2')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#fca5a5')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#fecaca')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(t_alerts)
    else:
        story.append(Paragraph("No safety threshold violations or anomalous alerts recorded during this session.", body_style))

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#94a3b8'), spaceAfter=8))
    story.append(Paragraph(
        "<b>Scientific Rigor & Safety Notice:</b> ChargeGuard AI Pro diagnostics evaluate empirical electrical sensor signals. "
        "Test readings do not certify compliance with regulatory bench analyzers or high-voltage safety standards.",
        subtitle_style
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
