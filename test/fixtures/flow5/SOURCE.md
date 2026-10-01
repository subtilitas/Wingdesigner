# flow5 test files

Test input for the flow5 import (`test/flow5-*.test.js`, `e2e/flow5.spec.js`). Every file was written by a local
build of flow5 from Wingdesigner's own inputs: planes, wings and airfoil choices listed below. flow5's own sample
files are not used. License: MIT, as the project (`LICENSE`).

The files were written by local drivers that link the flow5 libraries (GPL-3.0) of flow5 at commit 080d534 of
2026-10-01 (after tag v7.57; written "flow5 7.57" below) and of flow5 7.56 (tag v7.56), built on Ubuntu 24.04 with Qt
6.4.2, OpenCascade 7.6.3, gmsh 4.12.1 and OpenBLAS 0.3.26. The drivers and the build changes are not part of this
repository; the output files contain no flow5 code. The readers in `src/import/fl5.js` and `src/import/fl5xml.js`
are written from a description of the formats, not from flow5's code.

| File | Bytes | Written by | Content |
|---|---|---|---|
| `basic.fl5` | 8,648 | flow5 7.57, project save | Airfoils NACA 2412 and NACA 0009 (flow5's NACA generator, 100 panels). Plane "Test plane": main wing "Main" (3 sections: y 0, 0.4, 0.7 m; chord 0.24, 0.20, 0.12 m; offset 0, 0.01, 0.05 m; dihedral 3°, 6°; twist 0°, −1°, −2°), elevator "Stab" (position 0.8, 0, 0.05 m, Ry −1.5°), one-sided fin "Fin" (Rx −90°). Project format 500754. |
| `basic-plane.xml` | 10,631 | flow5 7.57, plane XML export | Plane "Test plane" in metres, airfoils by name. |
| `basic-wing.xml` | 3,094 | flow5 7.57, wing XML export | Wing "Stab" in metres. |
| `full.fl5` | 116,772 | flow5 7.57, project save | Airfoils NACA 2412 with an airfoil analysis (Re 200,000, 0° to 4° in 2° steps) and its results saved, NACA 0009, "Flapped 2410" (NACA 2410 with a trailing-edge flap: hinge at 75 % chord, 5°). Plane "Tandem": main wings "Front" (Ry 1°; NACA 2412 to Flapped 2410) and "Rear" (position 0.6, 0, 0.05 m), elevator "Vee" (25° dihedral, position 1.0, 0, 0.08 m, Rx 10°, Ry −2°), other wings "Canard" (Ry 2°) and "Tilted other" (Rx 30°), one-sided fin; 3 bodies (flow5's default NURBS, flat-face and sections bodies); a plane analysis without results. Plane "Mesh plane": a box of 12 triangles, 0.4 × 0.1 × 0.05 m. Plane "Second": main wing "Wing2" at position 0.01, 0.02, 0.03 m. Lengths in the display unit mm. |
| `full-plane.xml` | 30,949 | flow5 7.57, plane XML export | Plane "Tandem" in millimetres, airfoils by name. flow5 writes the `.dat` files below next to it. |
| `full-plane-files.xml` | 31,093 | flow5 7.57, plane XML export with the option to include the airfoils | Plane "Tandem" in millimetres, airfoils as `.dat` file references (`Left_Side_Foil_File`). |
| `NACA 2412.dat`, `NACA 0009.dat`, `Flapped 2410.dat` | 2,782 to 2,785 | flow5 7.57, with `full-plane.xml` | The airfoils of plane "Tandem" as flow5 writes them next to an XML export. |
| `v756.fl5` | 85,968 | flow5 7.56, project save | Plane "Sections body": main wing "Main" (dihedral 4°, position 0, 0, 0.01 m, Ry 2°), elevator "Tail"; flow5's default sections body and NURBS body. Part format 500755: the sections body holds its section points after its frames. |
| `mesh-nodes.json` | 132,240 | flow5 7.57, analysis mesh | The nodes (mm, rounded to 0.0001 mm) of the thick-surface triangle mesh that flow5 builds for 10 wings of `basic.fl5` and `full.fl5`, with the wing position and angles: the reference of the geometry test. |
