#!/usr/bin/env python3
"""Re-apply the branding fixes for the self-assessment checklist PDFs
(assets/self-assesment-checklist/*.pdf):

  1. Swap the header logo image for the current website logo.
  2. Point the footer link at the website instead of a mailto: address.
  3. Rename the footer company line to the current brand wording, bold.

Run whenever the logo, footer URL, or footer brand text needs to change again
(edit the constants below first). Idempotent: safe to re-run on already
up-to-date PDFs (steps that find nothing to change will just error out
cleanly on that file being skipped or already-migrated).

Usage:
    cd scripts/pdf-tools
    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python3 update_checklist_pdfs.py
"""

import glob
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import fitz
from pdf_edit_lib import replace_link, replace_page_image, replace_text_span

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHECKLIST_GLOB = os.path.join(REPO_ROOT, "assets/self-assesment-checklist/*.pdf")
LOGO_PATH = os.path.join(REPO_ROOT, "assets/Robotics Consulting-v5.png")

SITE_URL = "https://sia-robotics-consulting.eu"
FOOTER_BRAND_TEXT = "Robotics Consulting"


def update_pdf(path: str) -> None:
    doc = fitz.open(path)

    # 1. Header logo (page 1) - always re-applied, cheap and harmless if already current
    replace_page_image(doc[0], LOGO_PATH)

    # 2. Footer link -> site URL (page 2, skipped if already migrated)
    footer_page = doc[1]
    try:
        new_rect = replace_text_span(footer_page, "info@", SITE_URL, bold=True)
        replace_link(footer_page, "mailto:", SITE_URL, new_rect)
    except ValueError:
        print("  skip footer link (already up to date)")

    # 3. Footer brand line -> "Robotics Consulting", bold, re-centered
    # (matches "SIA Robotics Consulting" pre-migration or the bold version
    # post-migration; either way this is a no-op once already applied)
    try:
        replace_text_span(
            footer_page, "Robotics Consulting", FOOTER_BRAND_TEXT, bold=True, center_on_original=True
        )
    except ValueError:
        print("  skip footer brand text (not found)")

    tmp_path = path + ".tmp"
    doc.save(tmp_path, garbage=4, deflate=True)
    doc.close()
    os.replace(tmp_path, path)
    print("updated:", os.path.relpath(path, REPO_ROOT))


def main() -> None:
    paths = sorted(glob.glob(CHECKLIST_GLOB))
    if not paths:
        raise SystemExit(f"No PDFs found at {CHECKLIST_GLOB}")
    for path in paths:
        update_pdf(path)


if __name__ == "__main__":
    main()
