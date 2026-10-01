import { describe, expect, it } from 'vitest';
import { changelogProblems, tableLinkProblems, tableRows } from '../scripts/check-docs.mjs';

const lines = (...l) => l.join('\n');
const split = (file, line) => `${file}:${line}: wiki link split by the | of a table cell; in tables a wiki link holds only the page title`;
const noTable = (file, line) => `${file}:${line}: the header and delimiter rows form no table (a | in the header, e.g. in a wiki link?)`;

describe('documentation check: wiki links in tables', () => {
  it('finds header and body rows with and without outer pipes, and skips fenced code', () => {
    const text = lines(
      'Text with a | pipe and [[A|B]] outside a table.', // 0
      '',
      '| Page | Content |', // 2
      '| --- | --- |',
      '| [[User Guide|User-Guide]] | x |', // 4
      '',
      'Page | Content', // 6
      '--- | ---',
      '[[File Formats|File-Formats]] | y', // 8
      '',
      '```',
      '| [[File Formats|File-Formats]] |',
      '| --- |',
      '| z |',
      '```',
      '',
      '| Single |', // 16
      '| :---: |',
      '| [[Geometry]] |', // 18
      '',
      '---',
      'A rule above, not a table.',
    );
    expect(tableRows(text)).toEqual([2, 4, 6, 8, 16, 18]);
    expect(tableLinkProblems(text, 'p.md')).toEqual([split('p.md', 5), split('p.md', 9)]);
  });

  it('follows the Markdown rules for longer fences, the end of a table, leading-only pipes and block quotes', () => {
    // A three-backtick line inside a four-backtick fence does not close it.
    expect(tableLinkProblems(lines('````', '```', '| a | b |', '| - | - |', '| [[A|B]] | c |', '````'), 'p.md')).toEqual([]);
    // A heading right after a table ends the table.
    expect(tableLinkProblems(lines('| a | b |', '| - | - |', '| x | y |', '### See [[Geometry|Geometry]]'), 'p.md')).toEqual([]);
    // One column with leading pipes only, and a table in a block quote.
    expect(tableLinkProblems(lines('| Page', '| ---', '| [[User Guide|User-Guide]]'), 'p.md')).toEqual([split('p.md', 3)]);
    expect(tableLinkProblems(lines('> | a | b |', '> | --- | --- |', '> | [[User Guide|User-Guide]] | x |'), 'p.md')).toEqual([split('p.md', 3)]);
  });

  it('ignores code spans and HTML blocks, and reports a header that breaks the table', () => {
    // An escaped | in a code span keeps the cell; the code shows the syntax as it is.
    expect(tableLinkProblems(lines('| Example | Syntax |', '| --- | --- |', '| Link | `[[Label\\|Page]]` |'), 'p.md')).toEqual([]);
    // An HTML comment after a table is a block of its own.
    expect(tableLinkProblems(lines('| a | b |', '| - | - |', '| x | y |', '<!-- [[Label|Page]] -->'), 'p.md')).toEqual([]);
    // A piped link in the header gives it 3 cells against 2 in the delimiter row: no table at all.
    expect(tableLinkProblems(lines('Intro', '', '| [[User Guide|User-Guide]] | Description |', '| --- | --- |', '| a | b |'), 'p.md')).toEqual([noTable('p.md', 3)]);
    expect(tableLinkProblems(lines('> | [[A|B]] | c |', '> | --- | --- |'), 'q.md')).toEqual([noTable('q.md', 1)]);
  });

  it('accepts page-title links in tables and piped links outside them', () => {
    expect(tableLinkProblems('| [[User Guide]] | a |\n| --- | --- |\n| [[Geometry]] | b |\n\nSee [[Geometry|Geometry]].', 'p.md')).toEqual([]);
  });
});

describe('documentation check: release texts in the changelog', () => {
  const names = { functions: new Set(['buildWing', 'sectionPlanes']), constants: new Set(['FRAME_TOLERANCE', 'LIMITS']) };
  const keys = new Set(['sectionPlanes', 'panelAngle']);
  const found = (text) => changelogProblems(text, 'C.md', names, keys).map((p) => p.replace(/;.*$/, ''));

  it('reports contributor material in the version sections and skips the header', () => {
    const text = lines(
      '# Changelog', // 1
      'Handover and RECORD in the header do not count.',
      '',
      '## [Unreleased]', // 4
      '',
      '## [1.0.0] - 2026-01-01',
      '',
      '### Added',
      '- `docs/Handover.md` and RECORD.md: working agreements.', // 9
      '- `npm run docs:check` in CI checks `./scripts/check-docs.mjs`; 12 unit tests, 3 end-to-end tests, test coverage.', // 10
      '- `FRAME_TOLERANCE`, `LIMITS`, `tr()`, `mapXflr5(file)` and `buildWing` decide it; `npm test`, `npm ci`; see the Development page and', // 11
      '  [wing.js](https://github.com/o/r/blob/feature/foo/src/geom/wing.js).', // 12
    );
    expect(found(text)).toEqual([
      'C.md:9: release text names the handover (Handover)',
      'C.md:9: release text names RECORD.md (RECORD)',
      'C.md:10: release text names an npm command (npm run)',
      'C.md:10: release text names a path of the repository (./scripts/)',
      'C.md:10: release text names continuous integration (CI)',
      'C.md:10: release text names tests (unit tests)',
      'C.md:10: release text names tests (end-to-end tests)',
      'C.md:10: release text names test coverage (test coverage)',
      'C.md:11: release text names an npm command (npm test)',
      'C.md:11: release text names an npm command (npm ci)',
      'C.md:11: release text names the Development page (Development page)',
      'C.md:11: release text names a constant of the source code (`FRAME_TOLERANCE`)',
      'C.md:11: release text names a constant of the source code (`LIMITS`)',
      'C.md:11: release text names a function of the source code (`tr()`)',
      'C.md:11: release text names a function of the source code (`mapXflr5(file)`)',
      'C.md:11: release text names a function of the source code (`buildWing`)',
      'C.md:12: release text names a path of the repository (/blob/feature/foo/src/)',
    ]);
  });

  it('finds a term broken over two lines once, on the line where it starts, also after trailing spaces and CR', () => {
    const expected = [
      'C.md:2: release text names an npm command (npm run)',
      'C.md:3: release text names tests (browser tests)',
    ];
    expect(found(lines('## [1.0.0]', '- The check runs with npm', '  run and the browser', '  tests.'))).toEqual(expected);
    expect(found(['## [1.0.0]', '- The check runs with npm  ', '  run and the browser', '  tests.'].join('\r\n'))).toEqual(expected);
  });

  it('accepts the app, its files, its project format and its user documentation', () => {
    const text = lines(
      '## [1.0.0] - 2026-01-01',
      '- XFLR5 import: `foldedTilt` in the project JSON; `airfoils/NOTICE.md` in the app folder.',
      '- Settings: `settings.sectionPlanes` `"vertical"`; `panelAngle`; `sectionPlanes`.',
      '- Wiki: User Guide and File Formats; the airfoil check `te-crossed`; `LICENSES.txt` in the release zip.',
      '- STEP export: one `MANIFOLD_SOLID_BREP` per half; `FILE_NAME` holds the project name.',
      '- Development of the upper skin; the mesh coverage of the tip cap; Cirrus and ci words; every npm package of the bundle.',
    );
    expect(changelogProblems(text, 'C.md', names, keys)).toEqual([]);
  });
});
