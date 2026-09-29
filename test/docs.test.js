import { describe, expect, it } from 'vitest';
import { tableLinkProblems, tableRows } from '../scripts/check-docs.mjs';

const lines = (...l) => l.join('\n');

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
    expect(tableLinkProblems(text, 'p.md')).toEqual([
      'p.md:5: wiki link with | in a table row; in tables a wiki link holds only the page title',
      'p.md:9: wiki link with | in a table row; in tables a wiki link holds only the page title',
    ]);
  });

  it('follows the Markdown rules for longer fences, the end of a table, leading-only pipes and block quotes', () => {
    // A three-backtick line inside a four-backtick fence does not close it.
    expect(tableRows(lines('````', '```', '| a | b |', '| - | - |', '| [[A|B]] | c |', '````'))).toEqual([]);
    // A heading right after a table ends the table.
    const heading = lines('| a | b |', '| - | - |', '| x | y |', '### See [[Geometry|Geometry]]');
    expect(tableLinkProblems(heading, 'p.md')).toEqual([]);
    // One column with leading pipes only, and a table in a block quote.
    expect(tableLinkProblems(lines('| Page', '| ---', '| [[User Guide|User-Guide]]'), 'p.md')).toHaveLength(1);
    expect(tableLinkProblems(lines('> | a | b |', '> | --- | --- |', '> | [[User Guide|User-Guide]] | x |'), 'p.md')).toEqual([
      'p.md:3: wiki link with | in a table row; in tables a wiki link holds only the page title',
    ]);
  });

  it('accepts page-title links in tables and piped links outside them', () => {
    expect(tableLinkProblems('| [[User Guide]] | a |\n| --- | --- |\n| [[Geometry]] | b |\n\nSee [[Geometry|Geometry]].', 'p.md')).toEqual([]);
  });
});
