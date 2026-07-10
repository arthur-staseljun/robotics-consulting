"""Reusable helpers for surgically editing text/images in an existing PDF
with PyMuPDF, without rebuilding the whole document from source.

Used to keep the self-assessment checklist PDFs (assets/self-assesment-checklist/)
in sync with the website's branding (logo, footer link, footer company name).
"""

import fitz  # PyMuPDF


def replace_page_image(page: "fitz.Page", new_image_path: str, image_index: int = 0) -> None:
    """Swap the raster image embedded on a page for another file, keeping
    the original placement rect (position/size) on the page."""
    images = page.get_images(full=True)
    if not images:
        raise ValueError(f"No images found on page {page.number}")
    xref = images[image_index][0]
    page.replace_image(xref, filename=new_image_path)


def replace_text_span(
    page: "fitz.Page",
    match: str,
    new_text: str,
    *,
    bold: bool = False,
    center_on_original: bool = False,
    fontname: str | None = None,
    color: tuple[float, float, float] | None = None,
) -> fitz.Rect:
    """Find the first text span containing `match`, erase it (redaction),
    and insert `new_text` in its place using the same size/position.

    Returns the bounding rect of the newly inserted text (handy for
    re-attaching a link annotation over it).
    """
    target = None
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                if match in span["text"]:
                    target = span
                    break
    if not target:
        raise ValueError(f"No text span containing {match!r} found on page {page.number}")

    rect = fitz.Rect(target["bbox"])

    # Already applied (e.g. a re-run): skip redacting/reinserting so we don't
    # risk a redaction rect bleeding into a tightly-spaced neighboring line.
    if target["text"].strip() == new_text.strip():
        return rect

    fontsize = target["size"]
    if color is None:
        color_int = target["color"]
        color = (
            ((color_int >> 16) & 255) / 255,
            ((color_int >> 8) & 255) / 255,
            (color_int & 255) / 255,
        )
    font = fontname or ("hebo" if bold else "helv")

    # Keep vertical padding tight: these checklist PDFs have closely stacked
    # lines (e.g. footer brand line + link line), and a redaction rect that
    # bleeds into a neighboring line will erase part of it too.
    pad = fitz.Rect(rect.x0 - 2, rect.y0 - 0.25, rect.x1 + 2, rect.y1 + 0.25)
    page.add_redact_annot(pad, fill=(1, 1, 1))
    page.apply_redactions()

    text_width = fitz.get_text_length(new_text, fontname=font, fontsize=fontsize)
    if center_on_original:
        center_x = (rect.x0 + rect.x1) / 2
        origin_x = center_x - text_width / 2
    else:
        origin_x = target["origin"][0]
    origin = fitz.Point(origin_x, target["origin"][1])

    page.insert_text(origin, new_text, fontname=font, fontsize=fontsize, color=color, render_mode=0)
    return fitz.Rect(origin.x, rect.y0, origin.x + text_width, rect.y1)


def replace_link(page: "fitz.Page", old_uri_prefix: str, new_uri: str, new_rect: fitz.Rect) -> None:
    """Remove any link annotation whose URI starts with `old_uri_prefix` and
    add a new URI link over `new_rect`."""
    for link in page.get_links():
        if link.get("uri", "").startswith(old_uri_prefix):
            page.delete_link(link)
    page.insert_link({"kind": fitz.LINK_URI, "from": new_rect, "uri": new_uri})
