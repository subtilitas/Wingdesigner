# Airfoil sources

This page lists where airfoil coordinates come from and on which terms Wingdesigner uses them.
Quotes were checked on the live pages on 2026-09-29. This is a summary of published terms, not legal
advice.

## Summary

| Source | Terms | Redistribution in this app | Use in Wingdesigner |
| --- | --- | --- | --- |
| NACA 4- and 5-digit equations (NACA Report 824, 1945) | Published equations; the coordinates are computed, no data file is copied | yes | generated in the browser (library presets and the NACA generator) |
| aerodesign.de (Hartmut Siegmann), HS airfoils | Use with name and link; redistribution by third parties partly restricted; commercial use needs written permission | no | link only; users download and upload |
| aerodesign.de, third-party airfoils | Permission of each original author needed | no | link only |
| mh-aerotools.de (Martin Hepperle), MH airfoils | Personal use; publications cite the source; no recompilation sold above production cost | no (no explicit grant for public redistribution) | link only; users download and upload |
| UIUC Airfoil Coordinates Database | No license stated for the coordinate files; designers' rights apply | no | link only |

Uploaded airfoils stay in the user's browser and in the user's project file. The upload dialog fills
the attribution for names starting with `HS` (Hartmut Siegmann, www.aerodesign.de) and `MH`
(Martin Hepperle, www.mh-aerotools.de). The attribution is stored in the project JSON.

## aerodesign.de

Site of Hartmut Siegmann (Zorneding, Germany). The HS catalog (<https://aerodesign.de/profile/profile_hs.htm>)
lists 35 of his airfoils for planks, swept flying wings, gliders and F3x classes. Other catalogs list
third-party airfoils. All files are Selig-style `.dat`; some "original" files are percent tables with
decimal commas, which the Wingdesigner parser reads.

Terms, contact page (<https://aerodesign.de/kontakt/kontakt_m.htm>):

> Bei den Modell- und Profildatenbanken könnt ihr meine Profile (HS) und Konstruktionen (æ) für private
> und kleingewerbliche Zwecke genehmigungsfrei verwenden, aber nur unter Angabe meines Namens und Link
> auf aerodesign.de. [...] Wer Daten oder Inhalte ohne Quellenangabe oder gewerblich nutzen möchte, kann
> sich gerne schriftlich an mich wenden. Für andere Konstrukteure und Profilentwickler gilt diese Regelung
> selbstverständlich nicht. [...] müsst ihr euch die Nutzung von dem betreffenden Urheber genehmigen lassen.

Translation: the HS airfoils may be used without permission for private and small-business purposes,
only with his name and a link to aerodesign.de. Use without attribution or commercial use requires a
written request. This does not apply to other designers' airfoils; their use needs the permission of
the respective author.

HS catalog page:

> Meine Profile dürfen privat, im Vereinsrahmen, kleingewerblich und selbstverständlich wissenschaftlich
> unter Angabe meines Namens und der Quelle »www.aerodesign.de« genehmigungsfrei genutzt werden.
> Großserien oder industrielle Anwendungen erfordern eine schriftliche Nutzungsvereinbarung. Das Recht auf
> Weiterverbreitung durch Dritte ist aufgrund von Verlagsrechten zum Teil eingeschränkt, also solltet ihr
> aus Eigeninteresse Inhalte dieser Seite nicht kopieren, sondern nur auszugsweise zitieren.

Translation: private, club, small-business and scientific use is allowed with name and source.
Large series or industrial use need a written agreement. Redistribution by third parties is partly
restricted by publishing rights; content should not be copied, only quoted in excerpts.

The site states that e-mail requests are currently not answered; the contact is by post.

## mh-aerotools.de

Site of Martin Hepperle. The airfoil section (<https://www.mh-aerotools.de/airfoils/>) has 56 MH
airfoils, among them MH 44, 45, 46, 49, 60, 61, 62, 64 for flying wings and MH 30 to 34, 42, 43 for
gliders and pylon racers. Coordinates are HTML tables (8 of them in percent of chord) and XML files;
both load in Wingdesigner via upload.

Footer of every airfoil page, e.g. <https://www.mh-aerotools.de/airfoils/mh45koo.htm>:

> © 1996-2018 Martin Hepperle
> You may use the data given in this document for your personal use. If you use this document for a
> publication, you have to cite the source. A publication of a recompilation of the given material is
> not allowed, if the resulting product is sold for more than the production costs.

The grant covers personal use. Public redistribution in an MIT-licensed repository would allow resale
by others, which the last sentence excludes. Wingdesigner therefore does not bundle MH coordinates.

## UIUC Airfoil Coordinates Database

About 1,600 airfoils from many designers in Selig format (<https://m-selig.ae.illinois.edu/ads/coord_database.html>).
The coordinates page states no license; the page footer only carries the site copyright. The GPL
statement on the UIUC site belongs to the wind-tunnel performance data; whether it covers the
coordinate files is not stated. The designers' own terms (e.g. the MH terms above) apply to their files.

## Adding bundled airfoils

A file may be added to `public/airfoils/` only with a license that allows redistribution, recorded in
`public/airfoils/index.json` as `source.author`, `source.license` and `source.url`. CI runs
`npm run airfoils:check`, which rejects entries without these fields or with files that fail the checks.
Written permissions from designers are kept under `docs/licenses/`.
