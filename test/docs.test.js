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
  const names = (text) => changelogProblems(text, 'C.md').map((p) => p.replace(/;.*$/, ''));

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
      '- `npm run docs:check` in CI checks `scripts/check-docs.mjs`; 12 unit tests.', // 10
      '- `FRAME_TOLERANCE` and `tr()` decide it.', // 11
    );
    expect(names(text)).toEqual([
      'C.md:9: release text names the handover (Handover)',
      'C.md:9: release text names RECORD.md (RECORD)',
      'C.md:10: release text names an npm script (npm run)',
      'C.md:10: release text names a path of the repository (scripts/)',
      'C.md:10: release text names continuous integration (CI)',
      'C.md:10: release text names tests or coverage (unit tests)',
      'C.md:11: release text names a constant of the source code (`FRAME_TOLERANCE`)',
      'C.md:11: release text names a function of the source code (`tr()`)',
    ]);
  });

  it('finds a term broken over two lines once, on the line where it starts', () => {
    expect(names(lines('## [1.0.0]', '- The check runs with npm', '  run and the browser', '  tests.'))).toEqual([
      'C.md:2: release text names an npm script (npm run)',
      'C.md:3: release text names tests or coverage (browser tests)',
    ]);
  });

  it('accepts the app, its files and its user documentation', () => {
    const text = lines(
      '## [1.0.0] - 2026-01-01',
      '- XFLR5 import: `foldedTilt` in the project JSON; `airfoils/NOTICE.md` in the app folder.',
      '- Wiki: User Guide and File Formats; the airfoil check `te-crossed`; `LICENSES.txt` in the release zip.',
    );
    expect(changelogProblems(text)).toEqual([]);
  });
});
