import { describe, expect, it } from 'vitest';
import { tableLinkProblems, tableRows } from '../scripts/check-docs.mjs';

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
