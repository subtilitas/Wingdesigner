# Wingdesigner

Wingdesigner designs wings of radio-controlled (RC) model aircraft in the browser. It lofts one half
of the wing as a NURBS (non-uniform rational B-spline) surface through airfoil sections, mirrors it at
the plane y = 0 and exports STEP, STL, 3MF and a JSON project file.

- App: <https://subtilitas.github.io/Wingdesigner/>
- Source: <https://github.com/subtilitas/Wingdesigner>

## Pages

| Page | Content |
| --- | --- |
| [[User Guide|User-Guide]] | Workflow, wizard, sections, guide curves, touch controls, export options |
| [[Geometry|Geometry]] | How profiles, sections, guide curves and the surface are computed |
| [[File Formats|File-Formats]] | Accepted airfoil files, sanity checks, project JSON, STEP, STL, 3MF |
| [[Airfoil Sources|Airfoil-Sources]] | Where airfoils come from and under which terms |
| [[Development|Development]] | Architecture, build, tests, CI, releases |

These pages are generated from `docs/wiki/` in the repository and published by the Docs workflow.
Edits made directly in the wiki are overwritten on the next publish.
