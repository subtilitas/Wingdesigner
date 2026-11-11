"""Validate the STEP files of mold halves with OpenCascade (package cadquery-ocp).

Usage: python scripts/validate_mold.py cases.json
cases.json: [{"file": "a.step", "solids": 2, "total": v, "tolerance": 5e-5, "up": "z",
              "lower": true, "upper": true, "holes": n,
              "range": {"lower": [lo, hi], "upper": [lo, hi]}}, ...]
Checks per file: the reader transfers all roots; the solid count; every solid passes
BRepCheck_Analyzer, has a closed, consistently oriented shell and a positive volume; the volumes of
both halves add up to `total` (the slab of the two blocks less the half wing, the resin channel and
the holes) within the tolerance, by the surface integral of OpenCascade or, where that misses (it
is off by up to 1.2e-4 on trimmed faces of a parting surface that is not planar), on a tessellation with
MESH_DEFLECTION; each half spans its `range` along the up axis, z = 0 at the mean height of leading edge and trailing edge, within
RANGE_TOLERANCE; every solid has 2 cylindrical faces per hole; the edges of every planar face lie in its
plane within PLANE_TOLERANCE.
Exit code 1 on any failure.
"""
import json
import sys

from OCP.Bnd import Bnd_Box
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRep import BRep_Tool
from OCP.BRepGProp import BRepGProp
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.GeomAbs import GeomAbs_Cylinder, GeomAbs_Plane
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.ShapeAnalysis import ShapeAnalysis_Shell
from OCP.STEPControl import STEPControl_Reader
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_REVERSED, TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS

# Largest distance (mm) of an edge of a planar face from its plane, and the samples per edge.
PLANE_TOLERANCE = 1e-6
PLANE_SAMPLES = 20
# Linear deflection (mm) and angular deflection (rad) of the tessellation the volumes are measured on.
MESH_DEFLECTION = 0.004
MESH_ANGLE = 0.05
# Tolerance (mm) of the extent of a half along the up axis: the bounding box of a B-spline face follows
# its control points, which lie up to 0.05 mm outside the face at a leading edge.
RANGE_TOLERANCE = 0.1


def shapes(shape, kind):
    exp = TopExp_Explorer(shape, kind)
    out = []
    while exp.More():
        out.append(exp.Current())
        exp.Next()
    return out


def faces_of(solid):
    """Counts of planar and cylindrical faces, and the largest distance of a planar face's edges from its plane."""
    worst = 0.0
    planar = 0
    cylinders = 0
    for face in shapes(solid, TopAbs_FACE):
        surface = BRepAdaptor_Surface(TopoDS.Face(face))
        if surface.GetType() == GeomAbs_Cylinder:
            cylinders += 1
        if surface.GetType() != GeomAbs_Plane:
            continue
        planar += 1
        plane = surface.Plane()
        for edge in shapes(face, TopAbs_EDGE):
            curve = BRepAdaptor_Curve(TopoDS.Edge(edge))
            t0, t1 = curve.FirstParameter(), curve.LastParameter()
            for k in range(PLANE_SAMPLES + 1):
                worst = max(worst, plane.Distance(curve.Value(t0 + (t1 - t0) * k / PLANE_SAMPLES)))
    return planar, cylinders, worst


def mesh_volume(solid):
    """Volume of the tessellated solid (divergence theorem over its triangles)."""
    BRepMesh_IncrementalMesh(solid, MESH_DEFLECTION, False, MESH_ANGLE, True)
    total = 0.0
    for face in shapes(solid, TopAbs_FACE):
        face = TopoDS.Face(face)
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is None:
            continue
        sign = -1.0 if face.Orientation() == TopAbs_REVERSED else 1.0
        trsf = loc.Transformation()
        for i in range(1, tri.NbTriangles() + 1):
            a, b, c = (tri.Node(k).Transformed(trsf) for k in tri.Triangle(i).Get())
            total += sign * (a.X() * (b.Y() * c.Z() - b.Z() * c.Y()) - a.Y() * (b.X() * c.Z() - b.Z() * c.X()) + a.Z() * (b.X() * c.Y() - b.Y() * c.X())) / 6
    return total


def up_range(solid, up):
    """Lowest and highest coordinate of the solid along the up axis."""
    box = Bnd_Box()
    BRepBndLib.AddOptimal_s(solid, box, False, False)
    lo, hi = box.CornerMin(), box.CornerMax()
    return (lo.Z(), hi.Z()) if up == "z" else (lo.Y(), hi.Y())


def check(case):
    reader = STEPControl_Reader()
    if reader.ReadFile(case["file"]) != IFSelect_RetDone:
        return {"file": case["file"], "ok": False, "error": "read failed"}
    reader.TransferRoots()
    solids = shapes(reader.OneShape(), TopAbs_SOLID)
    report = {"file": case["file"], "solids": [], "ok": True}
    if len(solids) != case["solids"]:
        report["ok"] = False
        report["error"] = f"expected {case['solids']} solids, found {len(solids)}"
    # The file lists the lower half first.
    sides = [s for s in ("lower", "upper") if case[s]]
    total = 0.0
    for i, solid in enumerate(solids):
        props = GProp_GProps()
        BRepGProp.VolumeProperties_s(solid, props, 1e-9)
        volume = props.Mass()
        total += volume
        valid = BRepCheck_Analyzer(solid).IsValid()
        sas = ShapeAnalysis_Shell()
        sas.LoadShells(solid)
        closed = not sas.CheckOrientedShells(solid, True) and not sas.HasFreeEdges()
        planar, cylinders, plane_distance = faces_of(solid)
        lo, hi = up_range(solid, case["up"])
        side = sides[i] if i < len(sides) else "?"
        want = case["range"].get(side)
        on_side = want is not None and abs(lo - want[0]) <= RANGE_TOLERANCE and abs(hi - want[1]) <= RANGE_TOLERANCE
        entry = {"side": side, "volume": volume, "valid": valid, "closed": closed, "faces": len(shapes(solid, TopAbs_FACE)), "planar_faces": planar,
                 "cylinders": cylinders, "plane_distance": plane_distance, "up_range": [lo, hi], "on_side": on_side}
        if not valid or not closed or volume <= 0 or not on_side or cylinders != 2 * case["holes"] or plane_distance > PLANE_TOLERANCE:
            report["ok"] = False
        report["solids"].append(entry)
    if case["total"] is not None:
        report["total"] = total
        report["rel_error"] = abs(total - case["total"]) / case["total"]
        report["volume_by"] = "integral"
        if report["rel_error"] > case["tolerance"]:
            meshed = sum(mesh_volume(solid) for solid in solids)
            report["total"] = meshed
            report["integral_rel_error"] = report["rel_error"]
            report["rel_error"] = abs(meshed - case["total"]) / case["total"]
            report["volume_by"] = "tessellation"
            if report["rel_error"] > case["tolerance"]:
                report["ok"] = False
    return report


def main():
    with open(sys.argv[1], encoding="utf-8") as fh:
        cases = json.load(fh)
    results = [check(c) for c in cases]
    print(json.dumps(results, indent=2))
    sys.exit(0 if all(r["ok"] for r in results) else 1)


if __name__ == "__main__":
    main()
