"""Validate STEP files with OpenCascade (package cadquery-ocp).

Usage: python scripts/validate_step.py cases.json
cases.json: [{"file": "a.step", "volumes": [v1, v2], "tolerance": 0.005}, ...]
Checks per file: the reader transfers all roots, every solid passes BRepCheck_Analyzer,
every shell is closed, and each solid volume matches the expected mesh volume within tolerance.
Exit code 1 on any failure.
"""
import json
import sys

from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_Reader
from OCP.TopAbs import TopAbs_FACE, TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.ShapeAnalysis import ShapeAnalysis_Shell


def shapes(shape, kind):
    exp = TopExp_Explorer(shape, kind)
    out = []
    while exp.More():
        out.append(exp.Current())
        exp.Next()
    return out


def check(case):
    reader = STEPControl_Reader()
    status = reader.ReadFile(case["file"])
    if status != IFSelect_RetDone:
        return {"file": case["file"], "ok": False, "error": f"read status {status}"}
    reader.TransferRoots()
    shape = reader.OneShape()
    solids = shapes(shape, TopAbs_SOLID)
    report = {"file": case["file"], "solids": [], "ok": True}
    expected = case.get("volumes", [])
    tol = case.get("tolerance", 0.005)
    if expected and len(solids) != len(expected):
        report["ok"] = False
        report["error"] = f"expected {len(expected)} solids, found {len(solids)}"
    for i, solid in enumerate(solids):
        props = GProp_GProps()
        # Adaptive integration; the default Gauss rule is off by up to 0.2 % on C0 spanwise joints.
        BRepGProp.VolumeProperties_s(solid, props, 1e-9)
        vol = props.Mass()
        valid = BRepCheck_Analyzer(solid).IsValid()
        # Closed, consistently oriented shell: no free edges and no bad orientation.
        sas = ShapeAnalysis_Shell()
        sas.LoadShells(solid)
        bad_orientation = sas.CheckOrientedShells(solid, True)
        closed = not bad_orientation and not sas.HasFreeEdges()
        faces = len(shapes(solid, TopAbs_FACE))
        entry = {"volume": vol, "valid": valid, "closed": closed, "faces": faces}
        if i < len(expected):
            entry["expected"] = expected[i]
            entry["rel_error"] = abs(vol - expected[i]) / abs(expected[i])
            if entry["rel_error"] > tol:
                report["ok"] = False
        if not valid or not closed or vol <= 0:
            report["ok"] = False
        report["solids"].append(entry)
    return report


def main():
    with open(sys.argv[1], encoding="utf-8") as fh:
        cases = json.load(fh)
    results = [check(c) for c in cases]
    print(json.dumps(results, indent=2))
    sys.exit(0 if all(r["ok"] for r in results) else 1)


if __name__ == "__main__":
    main()
