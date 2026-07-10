# PDF tools

Scripts for editing the self-assessment checklist PDFs in
`assets/self-assesment-checklist/` in place (logo, footer link, footer
brand text) without needing the original design source file.

## Setup

```bash
cd scripts/pdf-tools
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Usage

```bash
.venv/bin/python3 update_checklist_pdfs.py
```

Edits `LOGO_PATH`, `SITE_URL`, and `FOOTER_BRAND_TEXT` at the top of
`update_checklist_pdfs.py` to change what gets applied next time (e.g. a new
logo file, a new footer URL, a renamed brand). The script is safe to re-run —
steps that find nothing to change are skipped.

`pdf_edit_lib.py` has the generic building blocks (`replace_page_image`,
`replace_text_span`, `replace_link`) if you need to make a different one-off
edit to one of these PDFs.
