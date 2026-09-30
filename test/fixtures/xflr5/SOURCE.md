# XFLR5 test files

Test input for the XFLR5 import (`test/xflr5-*.test.js`, `e2e/xflr5.spec.js`). XFLR5 itself ships no sample
projects or plane files.

| File | Bytes | Origin | License |
|---|---|---|---|
| `fixtures_v662.xfl` | 11,092 | Own work. Two test planes ("Fixture A": main wing, elevator, fin, tilt, dihedral, twist; "Fixture B": no elevator), saved by the project writer of XFLR5 6.62 (SVN trunk r1506, Qt 5.15.13). Project format 200002, plane 100002, wing 100001, foil 100007. | MIT, as the project (`LICENSE`) |
| `xml_mm/0.plane.xml`, `xml_mm/0.w2.wing.xml`, `xml_mm/0.w3.wing.xml` | 2,154 to 7,493 | Own work. XML plane and wing export of plane "Fixture A" by the XML writer of XFLR5 6.62, lengths in millimetres. `0.w2` is the elevator, `0.w3` the fin as wing-only files. | as above |
| `xml_in/0.plane.xml` | 7,494 | Own work. The same plane exported in inches. | as above |
| `xml_m/1.plane.xml` | 3,936 | Own work. Plane "Fixture B" exported in metres. | as above |
| `uaslab/Rascal110.xfl` | 397,086 | [UASLab/OpenFlightSim](https://github.com/UASLab/OpenFlightSim), commit b020511223946b8642c73a35eacd17c4d5c09ddf, `AeroDefinitions/XFLR5/Rascal110/Rascal110.xfl`. Real XFLR5 output: project format 200001 (XFLR5 6.10 to 6.43), inches, body, 13-section main wing, 9-section elevator, flap airfoils at 0°. | MIT, `uaslab/LICENSE.md` |
| `uaslab/UltraStick25e.xml` | 16,852 | UASLab/OpenFlightSim, same commit, `AeroDefinitions/XFLR5/UltraStick25e/UltraStick25e.xml`. XFLR5 plane XML in inches. | MIT, `uaslab/LICENSE.md` |
| `uaslab/UltraStick25e_v662_stripped.xfl` | 28,418 | Derived from `UltraStick25e.xfl` of the same commit: loaded and saved by the project writer of XFLR5 6.62 with the analyses and results left out (project format 200002). The same plane as `UltraStick25e.xml`. | MIT, `uaslab/LICENSE.md` |

The own-work files were written by a local driver that links the XFLR5 6.62 sources (GPL-2.0-or-later). The driver
is not part of this repository; its output files contain no XFLR5 code.
