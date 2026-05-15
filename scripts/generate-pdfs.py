"""
Generate the Luna Travel demo PDF document pack — HTML + Playwright.

Mirrors the design language of tg-widgets' public/_pdf-template.js exactly:
  - Inter (body) + Fraunces (display) via Google Fonts
  - Travelgenix navy #1B2B5B → primary-dark gradient header
  - 240px hero with overlay (dark gradient, bottom-up)
  - "✓ Confirmed" green pill, optional "ATOL Protected" purple pill
  - Ref bar — 3 grid cells (Booking ref / Issued / Total)
  - .pdf-kv definition lists, .pdf-pay payment box with breakdown lines
  - .pdf-banner cyan info callout, .pdf-policies grid
  - Page 2 with hotel detail + amenities (when justified)

Output: public/documents/{REFERENCE}/{kind}.pdf for every booking.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(__file__))
from booking_data import BOOKINGS, DEMO_AGENCY  # noqa: E402


# ── Brand tokens (matches widget _pdf-template.js exactly) ──────────────────
PRIMARY = "#1B2B5B"
ACCENT = "#00B4D8"
SUCCESS = "#10B981"
WARNING = "#F59E0B"
TEXT = "#0F172A"
TEXT_2 = "#475569"
TEXT_3 = "#94A3B8"
BG = "#F8FAFC"
BG_2 = "#F1F5F9"
BORDER = "#E2E8F0"
BORDER_LIGHT = "#F1F5F9"


def shift_hex(hex_str: str, percent: int) -> str:
    """Lighten or darken a hex colour — mirrors the JS shiftHex function."""
    m = hex_str.lstrip("#")
    if len(m) != 6:
        return hex_str
    n = int(m, 16)
    r, g, b = (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF
    target = 255 if percent >= 0 else 0
    ratio = abs(percent) / 100
    adj = lambda c: round(c + (target - c) * ratio)
    return f"#{((adj(r) << 16) | (adj(g) << 8) | adj(b)):06x}"


PRIMARY_DARK = shift_hex(PRIMARY, -18)
ACCENT_DARK = shift_hex(ACCENT, -16)

ISSUED_AT = datetime.now()


def fmt_date_short(date_str: str | None) -> str:
    """ISO date → '5 Dec 2026' style."""
    if not date_str:
        return "—"
    try:
        # Accept 'YYYY-MM-DD' or full ISO
        d = datetime.fromisoformat(date_str.replace("Z", "+00:00")) if "T" in date_str else datetime.fromisoformat(date_str)
        return d.strftime("%-d %b %Y")
    except Exception:
        return date_str


def fmt_money(amount: str | float, currency: str = "GBP") -> str:
    symbols = {"GBP": "£", "EUR": "€", "USD": "$"}
    sym = symbols.get(currency.upper(), "£")
    try:
        n = float(amount)
        return f"{sym}{n:,.2f}"
    except Exception:
        return f"{sym}{amount}"


# ── Shared CSS block ────────────────────────────────────────────────────────
# Ported from public/_pdf-template.js, kept faithful to the widget exactly.
def page_css() -> str:
    return f"""
  :root {{
    --primary: {PRIMARY};
    --primary-dark: {PRIMARY_DARK};
    --accent: {ACCENT};
    --accent-dark: {ACCENT_DARK};
    --success: {SUCCESS};
    --warning: {WARNING};
    --text: {TEXT};
    --text-2: {TEXT_2};
    --text-3: {TEXT_3};
    --bg: {BG};
    --bg-2: {BG_2};
    --border: {BORDER};
    --border-light: {BORDER_LIGHT};
    --radius: 12px;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    --font-display: 'Fraunces', Georgia, serif;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: var(--font);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    background: #fff;
  }}
  .num, .price, time {{ font-variant-numeric: tabular-nums; }}

  .page {{
    width: 794px;
    min-height: 1123px;
    background: #fff;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }}
  .page:last-child {{ page-break-after: auto; }}

  /* Avoid breaking visual blocks mid-page */
  .pdf-section, .pdf-ref-bar, .pdf-pay-box, .pdf-banner,
  .pdf-flight-route, .pdf-extra-card, .pdf-contact-card,
  .pdf-amenity, .pdf-policy, .pdf-doc {{
    break-inside: avoid;
    -webkit-column-break-inside: avoid;
    page-break-inside: avoid;
  }}
  .pdf-section-title {{ break-after: avoid; page-break-after: avoid; }}

  /* HEADER */
  .pdf-header {{
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    color: #fff;
    padding: 24px 48px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .pdf-header-brand {{
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -.01em;
  }}
  .pdf-header-meta {{
    text-align: right;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: rgba(255,255,255,.72);
    line-height: 1.7;
  }}

  /* HERO */
  .pdf-hero {{
    position: relative;
    height: 240px;
  }}
  .pdf-hero-overlay {{
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(15,23,42,.05) 0%, rgba(15,23,42,.78) 100%);
  }}
  .pdf-hero-content {{
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 28px 48px;
    color: #fff;
  }}
  .pdf-confirmed {{
    display: inline-block;
    padding: 5px 12px;
    background: var(--success);
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }}
  .pdf-atol {{
    display: inline-block;
    padding: 5px 12px;
    background: linear-gradient(135deg, #4338CA, #5B21B6);
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #fff;
    margin-bottom: 12px;
    margin-left: 6px;
  }}
  .pdf-atol-shield {{ color: #FCD34D; margin-right: 4px; vertical-align: -1px; }}
  .pdf-hero-eyebrow {{
    font-size: 10px;
    font-weight: 500;
    letter-spacing: .08em;
    text-transform: uppercase;
    opacity: .85;
    margin-bottom: 4px;
  }}
  .pdf-hero-name {{
    font-family: var(--font-display);
    font-size: 34px;
    font-weight: 600;
    letter-spacing: -.02em;
    line-height: 1.05;
    margin: 0 0 8px;
  }}
  .pdf-hero-stars {{ display: inline-flex; gap: 2px; align-items: center; }}
  .pdf-hero-stars svg {{ display: block; }}

  /* BODY */
  .pdf-body {{ padding: 36px 48px; }}
  .pdf-greeting {{
    font-size: 14px;
    color: var(--text);
    line-height: 1.65;
    margin: 0 0 28px;
    max-width: 60ch;
  }}
  .pdf-greeting strong {{ font-weight: 600; }}

  /* SECTION */
  .pdf-section {{ margin-bottom: 24px; }}
  .pdf-section-title {{
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--text-3);
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }}

  /* REF BAR */
  .pdf-ref-bar {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 24px;
  }}
  .pdf-ref-cell {{ padding: 16px 20px; border-right: 1px solid var(--border); }}
  .pdf-ref-cell:last-child {{ border-right: none; }}
  .pdf-ref-label {{
    font-size: 9px; font-weight: 600; letter-spacing: .12em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 4px;
  }}
  .pdf-ref-value {{
    font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: .02em;
  }}
  .pdf-ref-value.money {{ font-size: 18px; letter-spacing: -.01em; }}

  /* KV */
  .pdf-kv {{
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 0 20px;
    font-size: 13px;
    margin: 0;
  }}
  .pdf-kv dt {{
    color: var(--text-2);
    padding: 10px 0;
    border-bottom: 1px solid var(--border-light);
  }}
  .pdf-kv dd {{
    margin: 0; padding: 10px 0;
    border-bottom: 1px solid var(--border-light);
    color: var(--text); font-weight: 500;
  }}
  .pdf-kv dt:last-of-type, .pdf-kv dd:last-of-type {{ border-bottom: none; }}

  /* PAYMENT */
  .pdf-pay-box {{
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px 20px;
  }}
  .pdf-pay-row {{
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 7px 0; font-size: 13px;
  }}
  .pdf-pay-row .label {{ color: var(--text-2); }}
  .pdf-pay-row .value {{ font-weight: 600; color: var(--text); }}
  .pdf-pay-row .value.paid {{ color: var(--success); }}
  .pdf-pay-row .value.due {{ color: var(--warning); }}
  .pdf-pay-row.total {{
    border-top: 1px solid var(--border);
    margin-top: 8px; padding-top: 14px; font-size: 14px;
  }}
  .pdf-pay-row.total .value {{ font-size: 20px; font-weight: 700; letter-spacing: -.01em; }}

  /* BANNER */
  .pdf-banner {{
    margin-top: 16px; padding: 14px 18px;
    background: #ECFEFF;
    border: 1px solid #A5F3FC;
    border-left: 3px solid var(--accent);
    border-radius: 8px;
    font-size: 12px; line-height: 1.5;
    color: #075985;
  }}
  .pdf-banner strong {{ color: var(--primary-dark); }}

  /* POLICIES */
  .pdf-policies {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
  .pdf-policy {{
    padding: 18px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
  }}
  .pdf-policy-label {{
    font-size: 10px; font-weight: 600; letter-spacing: .12em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 6px;
  }}
  .pdf-policy-title {{
    font-family: var(--font-display);
    font-size: 14px; font-weight: 600;
    color: var(--text); margin-bottom: 6px; letter-spacing: -.01em;
  }}
  .pdf-policy-body {{ font-size: 12px; line-height: 1.55; color: var(--text-2); }}
  .pdf-policy-body .good {{ color: var(--success); font-weight: 600; }}
  .pdf-policy-body strong {{ color: var(--text); }}

  /* FLIGHT ROUTE */
  .pdf-flight-route {{ padding: 14px 0; border-top: 1px solid var(--border); }}
  .pdf-flight-leg {{
    display: inline-block; padding: 2px 10px;
    background: var(--bg-2); border-radius: 9999px;
    font-size: 10px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-2); margin-bottom: 10px;
  }}
  .pdf-flight-table {{ width: 100%; border-collapse: collapse; }}
  .pdf-flight-cell-left {{ vertical-align: top; width: 35%; }}
  .pdf-flight-cell-mid {{ vertical-align: middle; text-align: center; width: 30%; }}
  .pdf-flight-cell-right {{ vertical-align: top; width: 35%; text-align: right; }}
  .pdf-flight-time {{
    font-size: 18px; font-weight: 700; color: var(--text);
    line-height: 1.1; font-variant-numeric: tabular-nums;
  }}
  .pdf-flight-iata {{
    font-size: 11px; font-weight: 600; color: var(--text-2);
    margin-top: 2px; letter-spacing: .04em;
  }}
  .pdf-flight-airport {{ font-size: 11px; color: var(--text-3); margin-top: 2px; }}
  .pdf-flight-line {{
    height: 1px; background: #CBD5E1; margin: 6px 12px;
    position: relative;
  }}
  .pdf-flight-line::before, .pdf-flight-line::after {{
    content: ''; position: absolute; top: -3px;
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--accent);
  }}
  .pdf-flight-line::before {{ left: 0; }}
  .pdf-flight-line::after {{ right: 0; }}
  .pdf-flight-meta {{
    margin-top: 10px; padding-top: 10px;
    border-top: 1px dashed var(--border);
    font-size: 11px; color: var(--text-2);
  }}
  .pdf-flight-meta strong {{ color: var(--text); }}

  /* EXTRA CARD */
  .pdf-extra-card {{
    margin-bottom: 16px; padding: 14px 16px;
    background: var(--bg); border-radius: 10px;
  }}
  .pdf-extra-eyebrow {{
    font-size: 10px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 4px;
  }}
  .pdf-extra-name {{
    font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 4px;
  }}

  /* CONTACT */
  .pdf-contact {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
  .pdf-contact-card {{
    padding: 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
  }}
  .pdf-contact-label {{
    font-size: 9px; font-weight: 600; letter-spacing: .12em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 4px;
  }}
  .pdf-contact-value {{ font-size: 13px; font-weight: 600; color: var(--text); }}
  .pdf-contact-value small {{
    display: block;
    font-size: 11px; color: var(--text-3);
    font-weight: 400; margin-top: 2px; letter-spacing: 0;
  }}

  /* AMENITIES */
  .pdf-amenities {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }}
  .pdf-amenity {{
    display: inline-block; padding: 4px 10px;
    background: var(--bg-2); border-radius: 9999px;
    font-size: 11px; color: var(--text-2);
  }}

  /* HOTEL DETAIL (page 2) */
  .pdf-hotel-h1 {{
    font-family: var(--font-display);
    font-size: 22px; font-weight: 600;
    color: var(--text); margin: 0 0 4px; letter-spacing: -.01em;
  }}
  .pdf-hotel-sub {{ font-size: 12px; color: var(--text-2); margin: 0 0 12px; }}
  .pdf-hotel-desc {{ font-size: 12px; line-height: 1.6; color: var(--text-2); margin: 12px 0; }}

  /* PAGE 2 HEADER (slimmer) */
  .pdf-page-header {{
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 14px 48px;
    display: flex; justify-content: space-between;
    font-size: 11px; color: var(--text-2);
  }}
  .pdf-page-header .brand {{
    font-family: var(--font-display); font-weight: 600; color: var(--text);
  }}

  /* FOOTER */
  .pdf-footer {{
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 14px 48px;
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-between;
    font-size: 10px; color: var(--text-3);
    letter-spacing: .04em;
  }}
  .pdf-footer-brand {{ font-family: var(--font-display); font-weight: 600; color: var(--text-2); }}

  @media print {{ body {{ background: #fff; }} }}
"""


# ── Hero gradients (per destination) ─────────────────────────────────────────
HERO_GRADIENTS = {
    "MV": "linear-gradient(135deg, #67E8F9 0%, #22D3EE 25%, #0891B2 60%, #082F49 100%)",
    "ES": "linear-gradient(135deg, #38BDF8 0%, #0284C7 50%, #0C4A6E 100%)",
    "AE": "linear-gradient(135deg, #FDBA74 0%, #C2410C 50%, #1E1B4B 100%)",
    "GR": "linear-gradient(135deg, #FEF3C7 0%, #3B82F6 40%, #0F172A 100%)",
}


def country_code_for(label: str) -> str:
    return {"Maldives": "MV", "Mallorca": "ES", "Dubai": "AE", "Athens": "GR"}.get(label, "MV")


def stars_svg(n: int) -> str:
    """Inline filled stars — matches the widget exactly."""
    if n <= 0:
        return ""
    star = '<svg viewBox="0 0 24 24" width="14" height="14" fill="#FFD166" aria-hidden="true"><polygon points="12 2 15 9 22 9.3 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9.3 9 9 12 2"/></svg>'
    return star * min(5, n)


def escape_html(s: str | None) -> str:
    if s is None:
        return ""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def doc_envelope(*, title: str, body_html: str, doc_kind_label: str, booking_ref: str) -> str:
    """Wrap the doc body in the full <html> shell with header + body + page wrapper."""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{escape_html(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet">
<style>{page_css()}</style>
</head>
<body>
{body_html}
</body>
</html>"""


# ── Document builders — every PDF is built by combining building blocks ────
def block_header(brand_name: str, doc_kind_label: str) -> str:
    return f"""
  <div class="pdf-header">
    <div class="pdf-header-brand">{escape_html(brand_name)}</div>
    <div class="pdf-header-meta">
      {escape_html(doc_kind_label)}<br>
      <span class="num">Issued {ISSUED_AT.strftime('%-d %b %Y')}</span>
    </div>
  </div>"""


def block_hero(*, country_code: str, eyebrow: str, name: str, stars: int = 0, atol: bool = False) -> str:
    gradient = HERO_GRADIENTS.get(country_code, HERO_GRADIENTS["MV"])
    stars_html = stars_svg(stars)
    atol_html = (
        f'''<div class="pdf-atol">
          <svg class="pdf-atol-shield" viewBox="0 0 24 24" width="11" height="11" fill="#FCD34D" aria-hidden="true"><path d="M12 1 4 4v8c0 5 3.5 9 8 11 4.5-2 8-6 8-11V4l-8-3z"/></svg>ATOL Protected
        </div>'''
        if atol
        else ""
    )
    return f"""
  <div class="pdf-hero" style="background: {gradient};">
    <div class="pdf-hero-overlay"></div>
    <div class="pdf-hero-content">
      <div class="pdf-confirmed">✓ Confirmed</div>{atol_html}
      <div class="pdf-hero-eyebrow">{escape_html(eyebrow)}</div>
      <div class="pdf-hero-name">{escape_html(name)}</div>
      {f'<div class="pdf-hero-stars">{stars_html}</div>' if stars_html else ''}
    </div>
  </div>"""


def block_ref_bar(reference: str, total: str | None = None) -> str:
    total_cell = ""
    if total:
        total_cell = f"""
      <div class="pdf-ref-cell">
        <div class="pdf-ref-label">Total</div>
        <div class="pdf-ref-value money num">{escape_html(total)}</div>
      </div>"""
    return f"""
    <div class="pdf-ref-bar">
      <div class="pdf-ref-cell">
        <div class="pdf-ref-label">Booking reference</div>
        <div class="pdf-ref-value num">{escape_html(reference)}</div>
      </div>
      <div class="pdf-ref-cell">
        <div class="pdf-ref-label">Issued</div>
        <div class="pdf-ref-value num" style="font-size:14px;">{ISSUED_AT.strftime('%-d %b %Y')}</div>
      </div>
      {total_cell or '<div class="pdf-ref-cell"><div class="pdf-ref-label">Status</div><div class="pdf-ref-value" style="color:var(--success); font-size:14px;">Confirmed</div></div>'}
    </div>"""


def block_kv(rows: list[tuple[str, str]]) -> str:
    items = "".join(
        f"<dt>{escape_html(k)}</dt><dd>{v}</dd>"  # value pre-escaped where needed
        for k, v in rows
        if v
    )
    return f'<dl class="pdf-kv">{items}</dl>'


def block_section(title: str, content: str) -> str:
    return f"""
    <div class="pdf-section">
      <div class="pdf-section-title">{escape_html(title)}</div>
      {content}
    </div>"""


def block_footer(reference: str, page_label: str = "Page 1 of 1") -> str:
    return f"""
  <div class="pdf-footer">
    <span class="pdf-footer-brand">{escape_html(DEMO_AGENCY['name'])}</span>
    <span class="num">Booking {escape_html(reference)} · {escape_html(page_label)}</span>
    <span>{escape_html(DEMO_AGENCY['email'])} · {escape_html(DEMO_AGENCY['atolNumber'])}</span>
  </div>"""


def block_greeting(lead_name: str, body_text: str) -> str:
    return f"""<p class="pdf-greeting">
      Dear <strong>{escape_html(lead_name)}</strong>, {escape_html(body_text)}
    </p>"""


def block_flight_route(f: dict, direction: str) -> str:
    """Render a single flight as a widget-style route block."""
    terminal_dep = f" · T{f['depTerminal']}" if f.get("depTerminal") and f["depTerminal"].isdigit() else f" · {f['depTerminal']}" if f.get("depTerminal") else ""
    return f"""
    <div class="pdf-flight-route">
      <div class="pdf-flight-leg">{escape_html(direction)}</div>
      <table class="pdf-flight-table">
        <tr>
          <td class="pdf-flight-cell-left">
            <div class="pdf-flight-time">{escape_html(f['depTime'])}</div>
            <div class="pdf-flight-iata">{escape_html(f['depAirport'])}{terminal_dep}</div>
            <div class="pdf-flight-airport">{escape_html(f['depAirportName'])}</div>
            <div class="pdf-flight-airport" style="margin-top:4px;">{escape_html(f['depDate'])}</div>
          </td>
          <td class="pdf-flight-cell-mid">
            <div style="font-size:10px; color:var(--text-3);" class="num">{escape_html(f['duration'])}</div>
            <div class="pdf-flight-line"></div>
            <div style="font-size:10px; color:var(--text-3);">Direct</div>
          </td>
          <td class="pdf-flight-cell-right">
            <div class="pdf-flight-time">{escape_html(f['arrTime'])}</div>
            <div class="pdf-flight-iata">{escape_html(f['arrAirport'])}</div>
            <div class="pdf-flight-airport">{escape_html(f['arrAirportName'])}</div>
            <div class="pdf-flight-airport" style="margin-top:4px;">{escape_html(f['arrDate'])}</div>
          </td>
        </tr>
      </table>
      <div class="pdf-flight-meta">
        <strong>{escape_html(f['carrier'])} {escape_html(f['flightNumber'])}</strong> · {escape_html(f['cabin'])}
        &nbsp;·&nbsp; {escape_html(f['baggage'])}
        &nbsp;·&nbsp; PNR <strong>{escape_html(f['pnr'])}</strong>
      </div>
    </div>"""


def block_seats_table(travellers: list[dict], flight: dict) -> str:
    """Per-flight traveller + seat table for the e-ticket."""
    rows_html = ""
    for t in travellers:
        name = f"{t['title']} {t['firstName']} {t['lastName']}"
        seat = flight["seats"].get(name, "—")
        rows_html += f"""
          <tr>
            <td style="padding:8px 12px; font-size:12px; color:var(--text); border-bottom:1px solid var(--border-light);">{escape_html(name)}</td>
            <td style="padding:8px 12px; font-size:12px; color:var(--accent-dark); font-weight:700; text-align:center; border-bottom:1px solid var(--border-light);" class="num">{escape_html(seat)}</td>
            <td style="padding:8px 12px; font-size:12px; color:var(--text-2); text-align:right; border-bottom:1px solid var(--border-light);">{escape_html(flight['cabin'])}</td>
          </tr>"""
    return f"""
    <table style="width:100%; border-collapse:collapse; margin-top:10px; background:var(--bg); border-radius:8px; overflow:hidden;">
      <thead>
        <tr style="background:var(--primary); color:#fff;">
          <th style="padding:10px 12px; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; text-align:left;">Traveller</th>
          <th style="padding:10px 12px; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase;">Seat</th>
          <th style="padding:10px 12px; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; text-align:right;">Cabin</th>
        </tr>
      </thead>
      <tbody>{rows_html}</tbody>
    </table>"""


# ── Build each document type ────────────────────────────────────────────────
def build_booking_pack(booking: dict) -> str:
    cc = country_code_for(booking["destinationLabel"])
    lead = next(t for t in booking["travellers"] if t.get("isLead"))
    accom = booking["hotels"][0] if booking["hotels"] else None
    total = fmt_money(booking["payment"]["total"])
    deposit = fmt_money(booking["payment"]["deposit"])
    balance = float(booking["payment"]["balance"])

    # Greeting body
    greeting_body = (
        f"thank you for booking your trip to {booking['destinationLabel']} with us. "
        f"This pack contains everything you need for your travels. Please keep it safe "
        f"and bring it with you, or save it to your phone."
    )

    # Trip overview KV
    trip_rows = [
        ("Destination", escape_html(booking["destinationLabel"])),
        ("Travelling", f"<span class='num'>{escape_html(booking['tripStart'])} → {escape_html(booking['tripEnd'])}</span> &nbsp;·&nbsp; {escape_html(booking['durationLabel'])}"),
        ("Travellers", escape_html(", ".join(f"{t['firstName']} {t['lastName']}" for t in booking["travellers"]))),
    ]
    if accom:
        stars_n = accom.get("stars", 0)
        trip_rows.extend([
            ("Accommodation", f"{escape_html(accom['name'])} &nbsp; {stars_svg(stars_n)}"),
            ("Address", escape_html(accom["address"])),
            ("Check-in", f"<span class='num'>{escape_html(accom['checkIn'])}</span>"),
            ("Check-out", f"<span class='num'>{escape_html(accom['checkOut'])}</span>"),
            ("Room", escape_html(accom["room"])),
            ("Board", escape_html(accom["board"])),
        ])
        if accom.get("specialRequests"):
            trip_rows.append(("Special requests", f'<span style="font-style:italic; color:var(--text-2);">{escape_html(accom["specialRequests"])}</span>'))

    # Flights section
    flights_html = ""
    if booking["flights"]:
        legs = []
        directions = ["Outbound"] + (["Return"] if len(booking["flights"]) > 1 else [])
        # Group flights by direction inferring from sequence; for simplicity each flight gets its own card
        for i, f in enumerate(booking["flights"]):
            dir_label = "Outbound" if i < len(booking["flights"]) // 2 + len(booking["flights"]) % 2 else "Return"
            if len(booking["flights"]) == 2:
                dir_label = "Outbound" if i == 0 else "Return"
            elif len(booking["flights"]) == 4:
                dir_label = "Outbound" if i < 2 else "Return"
            legs.append(block_flight_route(f, f"{dir_label} · Leg {i + 1}" if len(booking["flights"]) > 2 else dir_label))
        flights_html = block_section("Flights", "".join(legs))

    # Extras section
    extras_html = ""
    if booking["airportExtras"]:
        extra_cards = []
        for x in booking["airportExtras"]:
            extra_cards.append(f"""
            <div class="pdf-extra-card">
              <div class="pdf-extra-eyebrow">{escape_html(x['type'])}</div>
              <div class="pdf-extra-name">{escape_html(x['name'])}</div>
              <div style="font-size:12px; color:var(--text-2); padding-top:8px; border-top:1px solid var(--border);">
                <strong style="color:var(--text);">When:</strong> <span class="num">{escape_html(x['date'])} · {escape_html(x['time'])}</span><br>
                <strong style="color:var(--text);">Airport:</strong> {escape_html(x['airport'])}
                {f"<br><strong style='color:var(--text);'>Guests:</strong> {x['guests']}" if x.get("guests") else ""}
              </div>
              {f"<div style='margin-top:8px; font-size:11px; color:var(--text-2); font-style:italic;'>{escape_html(x['notes'])}</div>" if x.get('notes') else ''}
            </div>""")
        extras_html = block_section("Airport extras", "".join(extra_cards))

    # Payment section
    pay_box = f"""
    <div class="pdf-pay-box">
      <div class="pdf-pay-row">
        <span class="label">Total holiday cost</span>
        <span class="value num">{escape_html(total)}</span>
      </div>
      <div class="pdf-pay-row">
        <span class="label">Deposit paid</span>
        <span class="value paid num">– {escape_html(deposit)}</span>
      </div>"""
    if balance > 0:
        pay_box += f"""
      <div class="pdf-pay-row">
        <span class="label">Balance due by {escape_html(fmt_date_short(booking['payment']['balanceDueDate']))}</span>
        <span class="value due num">{escape_html(fmt_money(balance))}</span>
      </div>"""
    pay_box += f"""
      <div class="pdf-pay-row total">
        <span class="label">Total holiday cost</span>
        <span class="value num">{escape_html(total)}</span>
      </div>
    </div>"""

    payment_html = block_section("Payment", pay_box)

    # ATOL banner if applicable
    atol_banner = ""
    if booking.get("atol"):
        atol_banner = f"""
    <div class="pdf-banner">
      <strong>Financial protection:</strong> This holiday is protected by {DEMO_AGENCY['atolNumber']}.
      In the unlikely event of {DEMO_AGENCY['name']} becoming insolvent, your trip will be protected
      under the ATOL scheme. A separate ATOL Certificate is included in this pack.
    </div>"""

    # Policies / before-you-go
    policies = f"""
    <div class="pdf-policies">
      <div class="pdf-policy">
        <div class="pdf-policy-label">Before you travel</div>
        <div class="pdf-policy-title">Passports &amp; visas</div>
        <div class="pdf-policy-body">
          Check your passport is valid for the period required by your destination.
          Most destinations expect at least 3 months past your return date.
        </div>
      </div>
      <div class="pdf-policy">
        <div class="pdf-policy-label">Out of hours</div>
        <div class="pdf-policy-title">24h emergency</div>
        <div class="pdf-policy-body">
          Reach our duty manager any time on <strong class="num">{DEMO_AGENCY['emergencyPhone']}</strong>.
          For everything else, our office is open Mon–Sat.
        </div>
      </div>
    </div>"""

    body_html = f"""
<div class="page">
{block_header(DEMO_AGENCY['name'], 'Booking Pack')}
{block_hero(country_code=cc, eyebrow=booking['destinationLabel'], name=accom['name'] if accom else booking['destinationLabel'], stars=accom.get('stars', 0) if accom else 0, atol=booking.get('atol', False))}
<div class="pdf-body">
{block_greeting(f"{lead['title']} {lead['lastName']}", greeting_body)}
{block_ref_bar(booking['reference'], total)}
{block_section('Your trip', block_kv(trip_rows))}
{flights_html}
{extras_html}
{payment_html}
{atol_banner}
{block_section('Good to know', policies)}
</div>
{block_footer(booking['reference'], 'Page 1 of 1')}
</div>"""

    return doc_envelope(
        title=f"Booking Pack — {booking['reference']}",
        body_html=body_html,
        doc_kind_label="Booking Pack",
        booking_ref=booking["reference"],
    )


def build_eticket(booking: dict) -> str:
    if not booking["flights"]:
        return ""
    cc = country_code_for(booking["destinationLabel"])
    f0 = booking["flights"][0]

    # Render every flight as its own route block + per-flight seat table
    flight_blocks = []
    for i, f in enumerate(booking["flights"]):
        if len(booking["flights"]) == 2:
            dir_label = "Outbound" if i == 0 else "Return"
        elif len(booking["flights"]) == 4:
            dir_label = "Outbound · Leg " + str(i + 1) if i < 2 else "Return · Leg " + str(i - 1)
        else:
            dir_label = f"Flight {i + 1}"

        flight_blocks.append(block_flight_route(f, dir_label))
        flight_blocks.append(block_seats_table(booking["travellers"], f))
        flight_blocks.append('<div style="height:18px;"></div>')

    flights_section = block_section(
        f"Electronic ticket · {f0['carrier']}",
        "".join(flight_blocks),
    )

    intro = block_greeting(
        f"{booking['travellers'][0]['title']} {booking['travellers'][0]['lastName']}",
        f"this is your electronic ticket for travel with {f0['carrier']}. "
        f"Show this on your phone at check-in, with photo ID matching the traveller name. "
        f"Online check-in opens 24 hours before departure."
    )

    body_html = f"""
<div class="page">
{block_header(DEMO_AGENCY['name'], 'E-Ticket')}
{block_hero(country_code=cc, eyebrow=f"{f0['depAirport']} → {f0['arrAirport']}", name=f"{f0['carrier']}", stars=0)}
<div class="pdf-body">
{intro}
{block_ref_bar(booking['reference'])}
{flights_section}
<div class="pdf-banner">
  <strong>Check-in tip:</strong> Save a screenshot of your boarding pass to your phone's wallet
  once it's issued. Most airlines also let you check in through their own app —
  but this e-ticket is all you need at the desk.
</div>
</div>
{block_footer(booking['reference'])}
</div>"""

    return doc_envelope(
        title=f"E-Ticket — {booking['reference']}",
        body_html=body_html,
        doc_kind_label="E-Ticket",
        booking_ref=booking["reference"],
    )


def build_hotel_voucher(booking: dict) -> str:
    if not booking["hotels"]:
        return ""
    cc = country_code_for(booking["destinationLabel"])
    h0 = booking["hotels"][0]
    lead = next(t for t in booking["travellers"] if t.get("isLead"))

    intro = block_greeting(
        f"{lead['title']} {lead['lastName']}",
        f"present this voucher at hotel check-in. Your booking is fully prepaid — "
        f"incidentals (mini-bar, room service, etc.) are settled with the hotel on departure."
    )

    hotel_sections = []
    for h in booking["hotels"]:
        rows = [
            ("Hotel reference", f'<span class="num">{escape_html(h["ref"])}</span>'),
            ("Address", escape_html(h["address"])),
            ("Check-in", f'<span class="num">{escape_html(h["checkIn"])}</span>'),
            ("Check-out", f'<span class="num">{escape_html(h["checkOut"])}</span>'),
            ("Nights", str(h["nights"])),
            ("Room", escape_html(h["room"])),
            ("Board basis", escape_html(h["board"])),
            ("Travellers", escape_html(", ".join(f"{t['title']} {t['lastName']}" for t in booking["travellers"]))),
        ]
        if h.get("specialRequests"):
            rows.append(("Special requests", f'<span style="font-style:italic;">{escape_html(h["specialRequests"])}</span>'))
        hotel_sections.append(block_section(f'{h["name"]} {stars_svg(h.get("stars", 0))}', block_kv(rows)))

    body_html = f"""
<div class="page">
{block_header(DEMO_AGENCY['name'], 'Hotel Voucher')}
{block_hero(country_code=cc, eyebrow=h0.get('address', '').split(',')[0] if h0.get('address') else '', name=h0['name'], stars=h0.get('stars', 0))}
<div class="pdf-body">
{intro}
{block_ref_bar(booking['reference'])}
{"".join(hotel_sections)}
<div class="pdf-banner">
  <strong>On arrival:</strong> Show this voucher together with photo ID. The hotel may
  ask for a card pre-authorisation against incidentals; this is standard and your booking
  is otherwise paid in full.
</div>
</div>
{block_footer(booking['reference'])}
</div>"""

    return doc_envelope(
        title=f"Hotel Voucher — {booking['reference']}",
        body_html=body_html,
        doc_kind_label="Hotel Voucher",
        booking_ref=booking["reference"],
    )


def build_lounge_pass(booking: dict) -> str:
    lounge = next((x for x in booking["airportExtras"] if x["type"] == "Airport lounge"), None)
    if not lounge:
        return ""
    cc = country_code_for(booking["destinationLabel"])
    lead = next(t for t in booking["travellers"] if t.get("isLead"))
    guest_count = lounge.get("guests") or len(booking["travellers"])
    named_guests = booking["travellers"][:guest_count]

    intro = block_greeting(
        f"{lead['title']} {lead['lastName']}",
        f"this is your access pass to {lounge['name']}. Show it at lounge reception "
        f"together with your boarding pass and photo ID — names are checked against the manifest."
    )

    detail_rows = [
        ("Lounge", escape_html(lounge["name"])),
        ("Airport", escape_html(lounge["airport"])),
        ("Date", f'<span class="num">{escape_html(lounge["date"])}</span>'),
        ("Earliest access", f'<span class="num">{escape_html(lounge["time"])}</span>'),
        ("Guests", str(guest_count)),
    ]
    if lounge.get("notes"):
        detail_rows.append(("Notes", escape_html(lounge["notes"])))

    guests_rows = "".join(
        f"""<tr>
          <td style="padding:8px 12px; font-size:12px; color:var(--text); border-bottom:1px solid var(--border-light);">{escape_html(t['title'] + ' ' + t['firstName'] + ' ' + t['lastName'])}</td>
          <td style="padding:8px 12px; font-size:12px; color:var(--text-2); text-align:right; border-bottom:1px solid var(--border-light);">{
            'Adult' if t['type'] == 'adult' else f"Child ({t.get('age', '–')})"
          }</td>
        </tr>"""
        for t in named_guests
    )
    guests_table = f"""
    <table style="width:100%; border-collapse:collapse; margin-top:8px; background:var(--bg); border-radius:8px; overflow:hidden;">
      <thead>
        <tr style="background:var(--primary); color:#fff;">
          <th style="padding:10px 12px; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; text-align:left;">Name</th>
          <th style="padding:10px 12px; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; text-align:right;">Type</th>
        </tr>
      </thead>
      <tbody>{guests_rows}</tbody>
    </table>"""

    body_html = f"""
<div class="page">
{block_header(DEMO_AGENCY['name'], 'Lounge Pass')}
{block_hero(country_code=cc, eyebrow=f"Airport · {lounge['airport']}", name=lounge['name'], stars=0)}
<div class="pdf-body">
{intro}
{block_ref_bar(booking['reference'])}
{block_section('Pass details', block_kv(detail_rows))}
{block_section('Named guests', guests_table)}
</div>
{block_footer(booking['reference'])}
</div>"""

    return doc_envelope(
        title=f"Lounge Pass — {booking['reference']}",
        body_html=body_html,
        doc_kind_label="Lounge Pass",
        booking_ref=booking["reference"],
    )


def build_atol_certificate(booking: dict) -> str:
    if not booking.get("atol"):
        return ""
    cc = country_code_for(booking["destinationLabel"])
    lead = next(t for t in booking["travellers"] if t.get("isLead"))

    intro = block_greeting(
        f"{lead['title']} {lead['lastName']}",
        f"this certificate confirms that your trip to {booking['destinationLabel']} is "
        f"financially protected under the Civil Aviation Authority's ATOL scheme, "
        f"covering you in the unlikely event of {DEMO_AGENCY['name']} becoming insolvent."
    )

    detail_rows = [
        ("Booking reference", f'<span class="num">{escape_html(booking["reference"])}</span>'),
        ("Lead traveller", f"{escape_html(lead['title'])} {escape_html(lead['firstName'])} {escape_html(lead['lastName'])}"),
        ("Destination", escape_html(booking["destinationLabel"])),
        ("Travelling", f'<span class="num">{escape_html(fmt_date_short(booking["tripStart"]))} → {escape_html(fmt_date_short(booking["tripEnd"]))}</span>'),
        ("Travellers", str(len(booking["travellers"]))),
        ("Total trip cost", f'<span class="num">{escape_html(fmt_money(booking["payment"]["total"]))}</span>'),
        ("Licence holder", f"{DEMO_AGENCY['name']} ({DEMO_AGENCY['atolNumber']})"),
    ]

    policies = f"""
    <div class="pdf-policies">
      <div class="pdf-policy">
        <div class="pdf-policy-label">What's covered</div>
        <div class="pdf-policy-title">If we become insolvent</div>
        <div class="pdf-policy-body">
          <span class="good">Before you travel:</span> You receive a refund.<br>
          <span class="good">During your trip:</span> The CAA arranges to bring you home.<br>
          <span class="good">Your booking money:</span> Protected against loss.
        </div>
      </div>
      <div class="pdf-policy">
        <div class="pdf-policy-label">Making a claim</div>
        <div class="pdf-policy-title">CAA, not us</div>
        <div class="pdf-policy-body">
          Claims for ATOL refunds go directly to the Civil Aviation Authority.
          Keep this certificate with your other travel documents. More info at
          <strong>caa.co.uk/atol-protection</strong>.
        </div>
      </div>
    </div>"""

    body_html = f"""
<div class="page">
{block_header(DEMO_AGENCY['name'], 'ATOL Certificate')}
{block_hero(country_code=cc, eyebrow='Financial protection', name='ATOL Protected', stars=0, atol=True)}
<div class="pdf-body">
{intro}
{block_ref_bar(booking['reference'], fmt_money(booking['payment']['total']))}
{block_section('Certificate', block_kv(detail_rows))}
{block_section('Your protection', policies)}
<div class="pdf-banner">
  <strong>Why this matters:</strong> ATOL has refunded more than £4bn to travellers
  since 1973 in cases of operator failure. Your trip is fully protected.
</div>
</div>
{block_footer(booking['reference'])}
</div>"""

    return doc_envelope(
        title=f"ATOL Certificate — {booking['reference']}",
        body_html=body_html,
        doc_kind_label="ATOL Certificate",
        booking_ref=booking["reference"],
    )


def build_insurance(booking: dict) -> str:
    if not booking.get("insurance"):
        return ""
    cc = country_code_for(booking["destinationLabel"])
    lead = next(t for t in booking["travellers"] if t.get("isLead"))

    intro = block_greeting(
        f"{lead['title']} {lead['lastName']}",
        f"this is a summary of your Travelaire Worldwide Plus policy for your trip "
        f"to {booking['destinationLabel']}. The full policy wording is supplied separately by the insurer."
    )

    policy_rows = [
        ("Policy number", f'<span class="num">TA-WW-{booking["reference"][-5:]}</span>'),
        ("Policy holder", f"{escape_html(lead['title'])} {escape_html(lead['firstName'])} {escape_html(lead['lastName'])}"),
        ("Travellers covered", escape_html(", ".join(f"{t['firstName']} {t['lastName']}" for t in booking["travellers"]))),
        ("Trip", f'{escape_html(booking["destinationLabel"])} &nbsp;·&nbsp; <span class="num">{escape_html(fmt_date_short(booking["tripStart"]))} → {escape_html(fmt_date_short(booking["tripEnd"]))}</span>'),
        ("Cover level", "Worldwide (incl. UAE / Indian Ocean)"),
    ]

    cover_lines = [
        ("Medical emergency &amp; repatriation", "£10m"),
        ("Cancellation / curtailment", "£5,000"),
        ("Personal belongings", "£2,500 (single item £500)"),
        ("Money", "£500"),
        ("Personal liability", "£2m"),
        ("Missed departure", "£1,500"),
        ("Travel delay", "£20 per 12hrs (max £200)"),
    ]
    cover_table = """
    <table style="width:100%; border-collapse:collapse; background:var(--bg); border-radius:8px; overflow:hidden;">""" + "".join(
        f"""
        <tr>
          <td style="padding:10px 14px; font-size:13px; color:var(--text-2); border-bottom:1px solid var(--border-light);">{line[0]}</td>
          <td style="padding:10px 14px; font-size:13px; color:var(--primary); font-weight:700; text-align:right; border-bottom:1px solid var(--border-light);" class="num">{line[1]}</td>
        </tr>"""
        for line in cover_lines
    ) + "</table>"

    body_html = f"""
<div class="page">
{block_header(DEMO_AGENCY['name'], 'Travel Insurance Summary')}
{block_hero(country_code=cc, eyebrow='Travelaire Worldwide Plus', name='Travel insurance', stars=0)}
<div class="pdf-body">
{intro}
{block_ref_bar(booking['reference'])}
{block_section('Policy details', block_kv(policy_rows))}
{block_section('Cover headlines', cover_table)}
<div class="pdf-banner">
  <strong>In emergency:</strong> Call the 24-hour assistance line
  <strong class="num">+44 20 7946 0500</strong> quoting your policy number.
  Get authorisation before any non-emergency treatment.
</div>
<p style="margin-top:18px; font-size:11px; color:var(--text-3); line-height:1.55;">
  This summary is provided for convenience and does not replace the full policy document.
  Exclusions, conditions and excesses apply. Read the full policy wording before you travel.
</p>
</div>
{block_footer(booking['reference'])}
</div>"""

    return doc_envelope(
        title=f"Travel Insurance — {booking['reference']}",
        body_html=body_html,
        doc_kind_label="Insurance Summary",
        booking_ref=booking["reference"],
    )


# ── Render all PDFs ─────────────────────────────────────────────────────────
def render_pdfs():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_root = os.path.join(repo_root, "public", "documents")
    os.makedirs(out_root, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()

        for booking in BOOKINGS:
            out_dir = os.path.join(out_root, booking["reference"])
            os.makedirs(out_dir, exist_ok=True)
            print(f"\n{booking['reference']}  ({booking['destinationLabel']})")

            docs = [
                ("booking-pack.pdf", build_booking_pack(booking)),
                ("e-ticket.pdf", build_eticket(booking)),
                ("hotel-voucher.pdf", build_hotel_voucher(booking)),
                ("lounge-pass.pdf", build_lounge_pass(booking)),
                ("atol-certificate.pdf", build_atol_certificate(booking)),
                ("travel-insurance.pdf", build_insurance(booking)),
            ]

            for filename, html in docs:
                if not html:
                    continue
                pdf_path = os.path.join(out_dir, filename)
                page.set_content(html, wait_until="networkidle")
                # Give Google Fonts a beat to load
                page.wait_for_timeout(800)
                page.pdf(
                    path=pdf_path,
                    width="794px",
                    height="1123px",
                    print_background=True,
                    margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
                )
                print(f"  ✓ {pdf_path}")

        browser.close()

    print("\nDone.")


if __name__ == "__main__":
    render_pdfs()
