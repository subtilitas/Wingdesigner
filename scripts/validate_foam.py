"""Validate the foam-cutting files with independent readers: ezdxf (DXF), pypdf (PDF), the Python XML
parser (SVG) and zipfile (profile ZIP).

Usage: python scripts/validate_foam.py cases.json
cases.json: written by scripts/export-foam-cases.mjs.
Checks per case:
- ZIP: README.txt, segments.csv and an mm/ and normalized/ .dat file per segment end; every .dat file
  holds a name line and the expected number of points; segments.csv has one row per segment.
- DXF: ezdxf reads it with the recover module and its audit finds no error; the PROFILE layer holds
  one closed polyline per segment end with the expected vertex count; with no kerf, the width and
  height of each polyline equal those of its mm/ .dat profile within 0.001 mm.
- SVG: parses as XML, width and height in mm, one profile polygon per segment end.
- PDF: pypdf reads it; page count and page size (mm, either orientation) as expected; the text of each
  page holds its page label.
Exit code 1 on any failure.
"""
import io
import json
import sys
import xml.etree.ElementTree as ET
import zipfile

import ezdxf
import pypdf
from ezdxf import recover

PT = 72 / 25.4


def dat_points(text):
    lines = text.strip().splitlines()
    return lines[0], [tuple(float(v) for v in line.split()) for line in lines[1:]]


def extent(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return max(xs) - min(xs), max(ys) - min(ys)


def check(case):
    problems = []
    n = case["segments"]
    ends = [(i, e) for i in range(1, n + 1) for e in ("inboard", "outboard")]

    # Profile ZIP.
    with zipfile.ZipFile(case["zip"]) as z:
        names = set(z.namelist())
        expected = {"README.txt", "segments.csv"} | {f"{d}/segment-{i:02d}-{e}.dat" for d in ("mm", "normalized") for i, e in ends}
        if names != expected:
            problems.append(f"zip entries {sorted(names ^ expected)} differ")
        mm = {}
        for i, e in ends:
            for d in ("mm", "normalized"):
                head, pts = dat_points(z.read(f"{d}/segment-{i:02d}-{e}.dat").decode("ascii"))
                if len(pts) != case["points"]:
                    problems.append(f"{d}/segment-{i:02d}-{e}.dat: {len(pts)} points, expected {case['points']}")
                if f"segment {i} {e}" not in head:
                    problems.append(f"{d}/segment-{i:02d}-{e}.dat: name line {head!r}")
                if d == "mm":
                    mm[(i, e)] = pts
        rows = z.read("segments.csv").decode("ascii").strip().splitlines()
        if len(rows) != n + 1:
            problems.append(f"segments.csv: {len(rows) - 1} rows, expected {n}")

    # DXF.
    doc, auditor = recover.readfile(case["dxf"])
    if auditor.has_errors:
        problems.append(f"DXF audit: {len(auditor.errors)} errors")
    if doc.dxfversion != "AC1009":
        problems.append(f"DXF version {doc.dxfversion}")
    polylines = [p for p in doc.modelspace().query("POLYLINE") if p.dxf.layer == "PROFILE"]
    if [len(list(p.vertices)) for p in polylines] != case["vertices"]:
        problems.append(f"DXF profile vertex counts {[len(list(p.vertices)) for p in polylines]}, expected {case['vertices']}")
    if not all(p.is_closed for p in polylines):
        problems.append("DXF profile polyline not closed")
    if case["kerf"] == 0 and len(polylines) == len(ends):
        for p, key in zip(polylines, ends):
            pts = [tuple(v.dxf.location)[:2] for v in p.vertices]
            dw, dh = (abs(a - b) for a, b in zip(extent(pts), extent(mm[key])))
            if max(dw, dh) > 1e-3:
                problems.append(f"DXF polyline of segment {key[0]} {key[1]}: extent differs from the .dat file by {max(dw, dh):.4f} mm")

    # SVG.
    root = ET.parse(case["svg"]).getroot()
    if not (root.get("width", "").endswith("mm") and root.get("height", "").endswith("mm")):
        problems.append(f"SVG size {root.get('width')} x {root.get('height')}")
    svg_profiles = [el for el in root.iter("{http://www.w3.org/2000/svg}polygon") if el.get("class") == "profile"]
    if len(svg_profiles) != len(ends):
        problems.append(f"SVG: {len(svg_profiles)} profile polygons, expected {len(ends)}")

    # PDF.
    with open(case["pdf"], "rb") as f:
        reader = pypdf.PdfReader(io.BytesIO(f.read()), strict=True)
    if len(reader.pages) != case["pages"]:
        problems.append(f"PDF: {len(reader.pages)} pages, expected {case['pages']}")
    for k, page in enumerate(reader.pages):
        w = float(page.mediabox.width) / PT
        h = float(page.mediabox.height) / PT
        if abs(w - case["page_mm"][0]) > 0.01 or abs(h - case["page_mm"][1]) > 0.01 or sorted(case["page_mm"]) != sorted(case["paper"]):
            problems.append(f"PDF page {k + 1}: {w:.1f} x {h:.1f} mm")
        label = f"Page {k + 1} of {len(reader.pages)}."
        if label not in page.extract_text():
            problems.append(f"PDF page {k + 1}: no label {label!r}")
    return {"case": case["name"], "ok": not problems, "segments": n, "pages": len(reader.pages), "problems": problems}


def main():
    cases = json.load(open(sys.argv[1]))
    results = [check(c) for c in cases]
    print(json.dumps(results, indent=2))
    sys.exit(0 if cases and all(r["ok"] for r in results) else 1)


if __name__ == "__main__":
    main()
