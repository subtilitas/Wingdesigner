"""Validate 3MF files with lib3mf, the 3MF Consortium reference library (package lib3mf).

Usage: python scripts/validate_3mf.py cases.json
cases.json: [{"threemf": "a.3mf", "triangles": [n1, n2]}, ...] (written by export-step-cases.mjs)
Checks per file: the strict-mode reader loads the package without warnings, the file holds one mesh
object per expected shell with the expected triangle count, and every object is manifold and
consistently oriented. Exit code 1 on any failure.
"""
import json
import sys

import lib3mf


def check(wrapper, case):
    problems = []
    model = wrapper.CreateModel()
    reader = model.QueryReader("3mf")
    reader.SetStrictModeActive(True)
    reader.ReadFromFile(case["threemf"])
    for i in range(reader.GetWarningCount()):
        problems.append(f"reader warning: {reader.GetWarning(i)}")
    counts = []
    objects = model.GetMeshObjects()
    while objects.MoveNext():
        mesh = objects.GetCurrentMeshObject()
        counts.append(mesh.GetTriangleCount())
        if not mesh.IsManifoldAndOriented():
            problems.append(f"object {mesh.GetName()!r} is not manifold and oriented")
    if counts != case["triangles"]:
        problems.append(f"triangle counts {counts}, expected {case['triangles']}")
    return {"file": case["threemf"], "ok": not problems, "triangles": counts, "problems": problems}


def main():
    cases = [c for c in json.load(open(sys.argv[1])) if "threemf" in c]
    wrapper = lib3mf.get_wrapper()
    results = [check(wrapper, c) for c in cases]
    print(json.dumps(results, indent=2))
    sys.exit(0 if cases and all(r["ok"] for r in results) else 1)


if __name__ == "__main__":
    main()
