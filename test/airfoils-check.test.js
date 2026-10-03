import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkEntries } from '../scripts/check-airfoils.mjs';

const index = JSON.parse(readFileSync('public/airfoils/index.json', 'utf8'));
const notice = readFileSync('public/airfoils/NOTICE.md', 'utf8');
const readFile = (f) => readFileSync(`public/airfoils/${f}`, 'utf8');
// A copy of the index with entry `id` changed by `edit`.
const withEntry = (id, edit) => ({ airfoils: index.airfoils.map((a) => (a.id === id ? edit(structuredClone(a)) : a)) });
const problemsOf = (idx, text = notice) => checkEntries(idx, text, readFile).problems;

describe('airfoil library check (npm run airfoils:check)', () => {
  it('passes the bundled library, also with CRLF line endings in NOTICE.md', () => {
    expect(problemsOf(index)).toEqual([]);
    expect(problemsOf(index, notice.replaceAll('\n', '\r\n'))).toEqual([]);
  });

  it('accepts a written permission only for the recorded author, on the recorded site, with its NOTICE section', () => {
    expect(problemsOf(withEntry('mh-45', (a) => ((a.source.author = 'Martin Hepperle-Fake, www.example.com'), a)))).toEqual([
      'index.json entry "mh-45": no written permission is recorded for "Martin Hepperle-Fake, www.example.com".',
      'index.json entry "mh-45": mh-aerotools.de grants personal use only.',
    ]);
    expect(problemsOf(withEntry('mh-45', (a) => ((a.source.url = 'https://example.org/mh45.htm'), a)))).toEqual([
      'index.json entry "mh-45": source.url is not on mh-aerotools.de, the site of the written permission.',
    ]);
    // The permission opens the site for source.url only; the terms address stays restricted.
    expect(problemsOf(withEntry('mh-45', (a) => ((a.source.terms = 'https://www.mh-aerotools.de/airfoils/index.htm'), a)))).toEqual([
      'index.json entry "mh-45": mh-aerotools.de grants personal use only.',
    ]);
    // aerodesign.de has no recorded permission.
    expect(problemsOf(withEntry('mh-45', (a) => ((a.source.author = 'Hartmut Siegmann, www.aerodesign.de'), (a.source.url = 'https://aerodesign.de/profile/profile_hs.htm'), a)))).toEqual([
      'index.json entry "mh-45": no written permission is recorded for "Hartmut Siegmann, www.aerodesign.de".',
      'index.json entry "mh-45": aerodesign.de grants personal use only.',
    ]);
    const noSection = problemsOf(index, notice.replace('\n## MH airfoils\n', '\n## MH airfoil\n'));
    expect(noSection).toHaveLength(56);
    expect(noSection[0]).toBe('index.json entry "mh-1": NOTICE.md has no section "## MH airfoils" for the written permission.');
  });

  it('rejects other licenses, a restricted host on a free entry, and addresses that are not https', () => {
    expect(problemsOf(withEntry('mh-45', (a) => ((a.source.license = 'personal'), a)))).toEqual([
      'index.json entry "mh-45": source.license "personal" is not a free license (public-domain, CC0-1.0, Unlicense, CC-BY-4.0, CC-BY-3.0, MIT, BSD-2-Clause, BSD-3-Clause) or "written-permission".',
      'index.json entry "mh-45": mh-aerotools.de grants personal use only.',
      'index.json entry "mh-45": NOTICE.md has no row "| MH 45 | `mh-45.dat` | `personal` |" in its Files table.',
    ]);
    expect(problemsOf(withEntry('clark-y', (a) => ((a.source.url = 'https://www.mh-aerotools.de/airfoils/'), a)))).toEqual(['index.json entry "clark-y": mh-aerotools.de grants personal use only.']);
    for (const url of ['javascript://m-selig.ae.illinois.edu/%0Aalert(1)', 'http://m-selig.ae.illinois.edu/uiuc_lsat/s9104/s9104.html', 'not a url']) {
      expect(problemsOf(withEntry('s9104', (a) => ((a.source.url = url), a))), url).toEqual(['index.json entry "s9104": source.url is not an https URL.']);
    }
  });

  it('finds every entry by its row in the Files table of NOTICE.md, not by a part of a longer name', () => {
    // Without the rows of MH 1 and MH 18, the names still occur inside "MH 16" and "MH 18B".
    const rows = notice.replace(/^\| MH 1 \| .*\n/gm, '').replace(/^\| MH 18 \| .*\n/gm, '');
    expect(rows).toContain('MH 16');
    expect(problemsOf(index, rows)).toEqual([
      'index.json entry "mh-1": NOTICE.md has no row "| MH 1 | `mh-1.dat` | `written-permission` |" in its Files table.',
      'index.json entry "mh-18": NOTICE.md has no row "| MH 18 | `mh-18.dat` | `written-permission` |" in its Files table.',
    ]);
  });
});
