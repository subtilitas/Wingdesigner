// Language switch: English by default, German for a German browser, the choice in the Settings tab
// (no reload; project, selection and undo history stay), the choice kept across reloads, and the
// German number format (decimal comma, dot groups) in the status bar, the Checks tab, the Settings
// tab and the wizard. Asserts the texts of the shell (top bar, tabs, status bar, Settings tab,
// wizard, Help and the Checks headings); the panels are translated and tested with their own specs.
import { checksValue, commit, createDesign, dialogOf, expect, frames, openTab, savedProject, sectionField, sectionRows, statusOf, test, toastOf } from './helpers.js';

const LANGUAGE_KEY = 'wingdesigner.language';
// Sport preset (1200 mm span, chords 240 / 144 mm) and the sample wing of the wizard's Skip button.
const SPORT = { en: 'Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm', de: 'Spannweite 1.200 mm · Fläche 23,04 dm² · AR 6,25 · MAC 196,0 mm' };
const SAMPLE = { en: 'Span 1500 mm · area 30.07 dm² · AR 7.48 · MAC 205.4 mm', de: 'Spannweite 1.500 mm · Fläche 30,07 dm² · AR 7,48 · MAC 205,4 mm' };

const TEXT = {
  en: {
    tabs: ['Sections', 'Planform', 'Airfoils', 'Settings', 'Checks'],
    top: ['New', 'Open', 'Save', 'Export', 'Undo', 'Redo', 'Help'],
    nav: 'Project',
    views: ['Iso', 'Top', 'Front', 'Side', 'Fit'],
    undoTitle: 'Undo (Ctrl+Z)',
    groups: ['Language / Sprache', 'Geometry', 'Resolution', 'Display'],
    projectName: 'Project name',
    smooth: 'Smooth (natural cubic spline through sections)',
    interpolation: 'Spanwise interpolation',
    mirrored: 'Show mirrored half (y < 0)',
    checksHeading: 'Geometry checks',
    span: 'Span',
    area: 'Wing area',
    ar: 'Aspect ratio',
    mac: 'Mean aerodynamic chord (MAC)',
    rootTip: 'Root / tip chord',
    surface: 'Surface',
    surfaceValue: /^degree \d+ x \d+, \d+ x \d+ control points$/,
    edge: 'Trailing edge',
    edgeValue: /^(open|closed)$/,
    loft: 'Loft grid: 1,089 points.',
    rootTipValue: '240.0 / 144.0 mm',
    spanValue: '1200.0 mm',
    areaValue: '23.04 dm²',
    arValue: '6.25',
    macValue: '196.0 mm',
    wizardHeading: 'Start a new wing design',
    helpHeading: 'Workflow',
    close: 'Close',
    errors: /^1 error\(s\): /,
    errorLabel: /^Error: /,
  },
  de: {
    tabs: ['Schnitte', 'Grundriss', 'Profile', 'Einstellungen', 'Prüfungen'],
    top: ['Neu', 'Öffnen', 'Speichern', 'Exportieren', 'Rückgängig', 'Wiederholen', 'Hilfe'],
    nav: 'Projekt',
    views: ['Iso', 'Oben', 'Vorne', 'Links', 'Einpassen'],
    undoTitle: 'Rückgängig (Strg+Z)',
    groups: ['Language / Sprache', 'Geometrie', 'Auflösung', 'Anzeige'],
    projectName: 'Projektname',
    smooth: 'Glatt (natürlicher kubischer Spline durch die Schnitte)',
    interpolation: 'Interpolation in Spannweitenrichtung',
    mirrored: 'Gespiegelte Hälfte zeigen (y < 0)',
    checksHeading: 'Geometrieprüfungen',
    span: 'Spannweite',
    area: 'Flügelfläche',
    ar: 'Streckung',
    mac: 'Mittlere aerodynamische Flügeltiefe (MAC)',
    rootTip: 'Wurzel- / Randtiefe',
    surface: 'NURBS-Fläche',
    surfaceValue: /^Grad \d+ x \d+, [\d.]+ x [\d.]+ Kontrollpunkte$/,
    edge: 'Endleiste',
    edgeValue: /^(offen|geschlossen)$/,
    loft: 'Flächengitter: 1.089 Punkte.',
    rootTipValue: '240,0 / 144,0 mm',
    spanValue: '1.200,0 mm',
    areaValue: '23,04 dm²',
    arValue: '6,25',
    macValue: '196,0 mm',
    wizardHeading: 'Neuen Flügelentwurf beginnen',
    helpHeading: 'Arbeitsablauf',
    close: 'Schließen',
    errors: /^1 Fehler: /,
    errorLabel: /^Fehler: /,
  },
};

const languageList = (page) => page.getByRole('combobox', { name: 'Language / Sprache', exact: true });
const settingsPane = (page) => page.locator('#pane-settings');
const button = (page, name) => page.getByRole('button', { name, exact: true });

/** Chooses a language in the Settings tab (opens the tab first). */
async function chooseLanguage(page, code, settingsName) {
  await openTab(page, settingsName);
  await frames(page);
  await languageList(page).selectOption(code);
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}

/** The shell speaks `lang`: page language, tabs, top bar and its tooltips, view buttons, aria-labels. */
async function expectShell(page, lang) {
  const t = TEXT[lang];
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.getByRole('tab')).toHaveText(t.tabs);
  for (const name of t.top) await expect(button(page, name)).toBeVisible();
  await expect(page.getByRole('navigation', { name: t.nav, exact: true })).toBeVisible();
  await expect(button(page, t.top[4])).toHaveAttribute('title', t.undoTitle);
  for (const name of t.views) await expect(button(page, name)).toBeVisible();
  // The other language's labels are gone.
  const other = TEXT[lang === 'en' ? 'de' : 'en'];
  await expect(page.getByRole('tab', { name: other.tabs[4], exact: true })).toHaveCount(0);
  await expect(button(page, other.top[3])).toHaveCount(0);
}

test.describe('English browser', () => {
  test('starts in English: page language, shell, status bar and a Settings tab that begins with the language list', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expectShell(page, 'en');
    await expect(statusOf(page)).toHaveText(SPORT.en);
    expect(await page.evaluate(() => localStorage.getItem('wingdesigner.language'))).toBeNull();

    await openTab(page, 'Settings');
    const groups = settingsPane(page).locator('fieldset > legend');
    await expect(groups).toHaveText(TEXT.en.groups);
    const list = languageList(page);
    await expect(list).toHaveValue('en');
    await expect(list.locator('option')).toHaveText(['English', 'Deutsch']);
    await expect(list.locator('option')).toHaveCount(2);
    expect(await list.locator('option').evaluateAll((os) => os.map((o) => o.value))).toEqual(['en', 'de']);
    // The label is the same in both languages, so a German user finds the list in an English page too.
    await expect(list).toHaveAccessibleName('Language / Sprache');
    await expect(settingsPane(page).getByRole('textbox', { name: TEXT.en.projectName })).toHaveValue('Sport');
  });

  test('switching to German in Settings translates the shell without a reload and keeps project, selection and undo history', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(statusOf(page)).toHaveText(SPORT.en);
    await expect(sectionRows(page)).toHaveCount(2);

    // Select section 2 and rename the project (one undo step), all in English.
    await sectionRows(page).nth(1).locator('th').click();
    await expect(sectionRows(page).nth(1)).toHaveClass(/selected/);
    await openTab(page, 'Settings');
    const name = settingsPane(page).getByRole('textbox', { name: TEXT.en.projectName });
    await name.fill('Alpha');
    await name.press('Enter');
    await frames(page);
    expect((await savedProject(page)).name).toBe('Alpha');
    // A marker of this page load: a reload would lose it.
    await page.evaluate(() => {
      window.__sameLoad = true;
    });

    await languageList(page).selectOption('de');
    await expectShell(page, 'de');
    await expect(statusOf(page)).toHaveText(SPORT.de);
    expect(await page.evaluate(() => window.__sameLoad)).toBe(true);
    expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY)).toBe('de');

    // The Settings tab stays open and speaks German; the project name is the one typed.
    await expect(page.getByRole('tab', { name: 'Einstellungen', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(settingsPane(page).locator('fieldset > legend')).toHaveText(TEXT.de.groups);
    await expect(languageList(page)).toHaveValue('de');
    await expect(settingsPane(page).getByRole('textbox', { name: TEXT.de.projectName })).toHaveValue('Alpha');
    await expect(settingsPane(page).getByRole('checkbox', { name: TEXT.de.mirrored })).toBeChecked();
    expect((await savedProject(page)).name).toBe('Alpha');

    // Project and selection are the same.
    await openTab(page, 'Schnitte');
    await expect(sectionRows(page)).toHaveCount(2);
    await expect(sectionRows(page).nth(1)).toHaveClass(/selected/);

    // The undo history is the same: Rückgängig takes back the rename, Wiederholen puts it back.
    await button(page, 'Rückgängig').click();
    await expect.poll(async () => (await savedProject(page)).name).toBe('Sport');
    await button(page, 'Wiederholen').click();
    await expect.poll(async () => (await savedProject(page)).name).toBe('Alpha');

    // Back to English through the same list, found under the same label.
    await chooseLanguage(page, 'en', 'Einstellungen');
    await expectShell(page, 'en');
    await expect(statusOf(page)).toHaveText(SPORT.en);
    await expect(settingsPane(page).getByRole('textbox', { name: TEXT.en.projectName })).toHaveValue('Alpha');
    expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY)).toBe('en');
  });

  test('the choice is kept after a reload, together with the project', async ({ page }) => {
    await createDesign(page, 'Sport');
    await chooseLanguage(page, 'de', 'Settings');
    await expect(statusOf(page)).toHaveText(SPORT.de);

    await page.reload();
    await expectShell(page, 'de');
    await expect(statusOf(page)).toHaveText(SPORT.de);
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(sectionRows(page)).toHaveCount(2);
    await expect(languageList(page)).toHaveValue('de');

    // Switching back is kept as well.
    await chooseLanguage(page, 'en', 'Einstellungen');
    await page.reload();
    await expectShell(page, 'en');
    await expect(statusOf(page)).toHaveText(SPORT.en);
    await expect(languageList(page)).toHaveValue('en');
  });

  test('a stored value that names no language is ignored', async ({ page }) => {
    await createDesign(page, 'Sport');
    await page.evaluate((key) => localStorage.setItem(key, 'fr'), LANGUAGE_KEY);
    await page.reload();
    await expectShell(page, 'en');
    await expect(statusOf(page)).toHaveText(SPORT.en);
  });

  test('German number format: status bar, Checks tab and the loft grid note of the Settings tab', async ({ page }) => {
    await createDesign(page, 'Sport');
    await chooseLanguage(page, 'de', 'Settings');
    await expect(statusOf(page)).toHaveText(SPORT.de);

    await openTab(page, 'Prüfungen');
    const t = TEXT.de;
    await expect(page.locator('#pane-checks h3')).toHaveText(t.checksHeading);
    await expect(page.locator('#pane-checks')).toContainText('Keine Fehler oder Warnungen.');
    await expect(checksValue(page, t.span)).toHaveText(t.spanValue);
    await expect(checksValue(page, t.area)).toHaveText(t.areaValue);
    await expect(checksValue(page, t.ar)).toHaveText(t.arValue);
    await expect(checksValue(page, t.mac)).toHaveText(t.macValue);
    await expect(checksValue(page, t.rootTip)).toHaveText(t.rootTipValue);
    await expect(checksValue(page, t.surface)).toHaveText(t.surfaceValue);
    await expect(checksValue(page, t.edge)).toHaveText(t.edgeValue);
    await expect(checksValue(page, 'Lage der MAC')).toHaveText(/^y \d+,\d mm, Profilnase x \d+,\d mm$/);

    // 1,089 points in English, 1.089 in German (smooth interpolation: 8 stations per panel).
    await openTab(page, 'Einstellungen');
    await settingsPane(page).getByRole('combobox', { name: t.interpolation, exact: true }).selectOption('smooth');
    await expect(settingsPane(page).locator('p.small').filter({ hasText: /^Flächengitter/ })).toHaveText(t.loft);
    await languageList(page).selectOption('en');
    await expect(settingsPane(page).locator('p.small').filter({ hasText: /^Loft grid/ })).toHaveText(TEXT.en.loft);
    await expect(settingsPane(page).getByRole('combobox', { name: TEXT.en.interpolation, exact: true })).toHaveValue('smooth');

    await openTab(page, 'Checks');
    await expect(checksValue(page, TEXT.en.span)).toHaveText(TEXT.en.spanValue);
    await expect(checksValue(page, TEXT.en.area)).toHaveText(TEXT.en.areaValue);
    await expect(checksValue(page, TEXT.en.rootTip)).toHaveText(TEXT.en.rootTipValue);
  });

  test('warnings and errors of the build are counted and labelled in the language of the moment', async ({ page }) => {
    await createDesign(page, 'Sport');
    // A very short tip chord is a build warning.
    await commit(sectionField(page, 1, 'chord'), 0.5);
    await expect(statusOf(page)).toHaveText(/ · 1 warning\(s\)$/);
    await chooseLanguage(page, 'de', 'Settings');
    await expect(statusOf(page)).toHaveText(/^Spannweite [\d.]+ mm · Fläche \d+,\d\d dm² · AR \d+,\d\d · MAC \d+,\d mm · 1 Warnung$/);
    await openTab(page, 'Prüfungen');
    await expect(page.locator('#pane-checks li.sev-warning strong')).toHaveText('Warnung:');
    await expect(page.locator('#pane-checks li.sev-warning')).toHaveText(/^Warnung: \S/);

    // The end line tip point in front of the nose line is a build error (as in planform.spec.js):
    // the status bar shows the first one.
    await chooseLanguage(page, 'en', 'Einstellungen');
    await openTab(page, 'Sections');
    await commit(sectionField(page, 1, 'chord'), 144);
    await openTab(page, 'Planform');
    const guide = (name) => page.locator('#pane-planform').getByRole('group', { name });
    await guide('Nose line (leading edge)').getByRole('checkbox', { name: 'Use guide curve' }).check();
    await guide('End line (trailing edge)').getByRole('checkbox', { name: 'Use guide curve' }).check();
    await expect(guide('End line (trailing edge)').locator('tbody tr')).toHaveCount(2);
    await commit(guide('End line (trailing edge)').locator('tbody tr').nth(1).getByRole('spinbutton'), 0);
    await expect(statusOf(page)).toHaveText(TEXT.en.errors);
    await expect(statusOf(page)).toHaveClass(/has-error/);
    const english = (await statusOf(page).innerText()).trim();
    await chooseLanguage(page, 'de', 'Settings');
    await expect(statusOf(page)).toHaveText(TEXT.de.errors);
    await expect(statusOf(page)).toHaveClass(/has-error/);
    await openTab(page, 'Prüfungen');
    await expect(page.locator('#pane-checks li.sev-error strong').first()).toHaveText('Fehler:');
    await expect(page.locator('#pane-checks li.sev-error').first()).toHaveText(TEXT.de.errorLabel);
    // The build was made again: the message follows the language (this wording is checked in the
    // specs of the areas that own the messages).
    expect((await statusOf(page).innerText()).trim()).not.toBe(english);
  });

  test('tooltips and aria-labels follow the language; the Help dialog opens in the chosen language', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(button(page, 'Save')).toHaveAttribute('title', 'Save the project as JSON');
    await expect(button(page, 'Fit')).toHaveAttribute('title', 'Fit the wing into the view');
    await chooseLanguage(page, 'de', 'Settings');
    await expect(button(page, 'Speichern')).toHaveAttribute('title', 'Projekt als JSON speichern');
    await expect(button(page, 'Einpassen')).toHaveAttribute('title', 'Flügel in die Ansicht einpassen');
    await expect(button(page, 'Wiederholen')).toHaveAttribute('title', 'Wiederholen (Strg+Umschalt+Z)');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^RC-Modellflügel im Browser entwerfen/);
    await expect(page.locator('.viewport canvas')).toHaveAttribute('aria-label', /^3D-Flügelansicht\./);
    // Parts that keep their DOM between renders are relabelled too: the rows of the project airfoils
    // (reused unless the language changed) and the toolbar, aria-label and readout of the Planform.
    await openTab(page, 'Profile');
    const projectAirfoils = page.locator('#pane-airfoils .airfoil-list').first();
    await expect(projectAirfoils.getByRole('button', { name: 'Anzeigen', exact: true }).first()).toBeVisible();
    await expect(projectAirfoils).toContainText('161 Punkte');
    await openTab(page, 'Grundriss');
    await expect(page.locator('.planform-canvas')).toHaveAttribute('aria-label', 'Grundriss-Editor');
    await expect(page.locator('#pane-planform .readout')).toHaveText(/^Punkte zum Bearbeiten ziehen/);

    await button(page, 'Hilfe').click();
    const help = dialogOf(page);
    await expect(help.getByRole('heading', { name: TEXT.de.helpHeading })).toBeVisible();
    // The wiki opens on an English home page: the German user guide is a page of its own.
    await expect(help.getByRole('link', { name: 'Dokumentation (Wiki)' })).toHaveAttribute('href', /\/wiki\/Benutzerhandbuch$/);
    await help.getByRole('button', { name: TEXT.de.close, exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);

    await chooseLanguage(page, 'en', 'Einstellungen');
    await expect(button(page, 'Save')).toHaveAttribute('title', 'Save the project as JSON');
    await expect(page.locator('.viewport canvas')).toHaveAttribute('aria-label', /^3D wing view\./);
    await openTab(page, 'Airfoils');
    const englishAirfoils = page.locator('#pane-airfoils .airfoil-list').first();
    await expect(englishAirfoils.getByRole('button', { name: 'View', exact: true }).first()).toBeVisible();
    await expect(englishAirfoils).toContainText('161 points');
    await openTab(page, 'Planform');
    await expect(page.locator('.planform-canvas')).toHaveAttribute('aria-label', 'Planform editor');
    await expect(page.locator('#pane-planform .readout')).toHaveText(/^Drag points to edit/);
    await button(page, 'Help').click();
    await expect(dialogOf(page).getByRole('heading', { name: TEXT.en.helpHeading })).toBeVisible();
    await expect(dialogOf(page).getByRole('link', { name: 'Documentation (wiki)' })).toHaveAttribute('href', /\/wiki$/);
    await dialogOf(page).getByRole('button', { name: TEXT.en.close, exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
  });

  test('a language switch drops a plain notice with its text and keeps an error notice', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(toastOf(page)).toHaveText('Created "Sport".');
    await chooseLanguage(page, 'de', 'Settings');
    // The plain notice is gone, and its English text does not stay in the page for a screen reader.
    await expect(toastOf(page)).toHaveText('');
    await expect(toastOf(page)).not.toHaveClass(/\bshow\b/);

    // An error notice can be the only place that tells the user, so it stays until its timer ends.
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button(page, 'Öffnen').click()]);
    await chooser.setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"x"}') });
    await expect(toastOf(page)).toHaveClass(/\berror\b/);
    await expect(toastOf(page)).toHaveClass(/\bshow\b/);
    await languageList(page).selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(toastOf(page)).toHaveClass(/\bshow\b/);
    await expect(toastOf(page)).toHaveText(/\S/);
  });
});

test.describe('German browser', () => {
  test.use({ locale: 'de-DE' });

  test('starts in German: wizard with German number format, sample wing, shell and status bar', async ({ page }) => {
    await page.goto('/');
    const wizard = dialogOf(page);
    await expect(wizard.getByRole('heading', { name: TEXT.de.wizardHeading })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(wizard.getByRole('radiogroup', { name: 'Entwurfstyp' })).toBeVisible();
    await expect(wizard.getByRole('textbox', { name: 'Projektname' })).toBeVisible();
    await expect(wizard.getByLabel('Spannweite (beide Hälften) (mm)')).toHaveValue('1200');
    await expect(wizard.getByLabel('Wurzeltiefe (mm)')).toBeVisible();
    await expect(wizard.getByLabel('Zuspitzung (Randtiefe / Wurzeltiefe)')).toBeVisible();
    await expect(wizard.getByLabel('Pfeilung der 25-%-Linie (°)')).toBeVisible();
    await expect(wizard.getByLabel('Anzahl der Schnitte')).toBeVisible();
    await expect(wizard.getByRole('combobox', { name: 'Grundriss', exact: true })).toBeVisible();
    await expect(wizard.getByRole('combobox', { name: 'Flügelende', exact: true })).toBeVisible();
    await expect(wizard.getByPlaceholder('NACA-Bezeichnung, z. B. 2412').first()).toBeVisible();
    await expect(wizard.locator('canvas')).toHaveAttribute('aria-label', 'Grundrissvorschau');
    await expect(wizard.getByRole('button', { name: 'Entwurf anlegen' })).toBeEnabled();
    // Figures of the previewed design: decimal comma.
    await expect(wizard.locator('p[aria-live="polite"]')).toHaveText(
      /^Fläche \d+,\d dm², Streckung \d+,\d\d, mittlere aerodynamische Flügeltiefe \d+,\d mm bei y = -?\d+ mm, Randtiefe \d+,\d mm\.$/,
    );
    // Number fields keep the plain number as their value.
    await expect(wizard.getByLabel('Zuspitzung (Randtiefe / Wurzeltiefe)')).toHaveValue('0.6');

    await wizard.getByRole('button', { name: 'Überspringen (Beispielflügel öffnen)' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expectShell(page, 'de');
    await expect(statusOf(page)).toHaveText(SAMPLE.de);
    // German labels are longer: on the phone the top bar, the tabs (Prüfungen lists the build errors) and the view
    // buttons must still lie inside the screen, not behind a sideways scroll.
    if (test.info().project.name === 'mobile') {
      const width = page.viewportSize().width;
      for (const b of await page.locator('.actions button, .tabs button, .view-tools button').all()) {
        const r = await b.boundingBox();
        expect(r, await b.innerText()).not.toBeNull();
        expect(r.x, await b.innerText()).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width, await b.innerText()).toBeLessThanOrEqual(width);
      }
    }
    // No choice is stored until the user makes one; the browser language decides.
    expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY)).toBeNull();

    await openTab(page, 'Einstellungen');
    await expect(settingsPane(page).locator('fieldset > legend')).toHaveText(TEXT.de.groups);
    await expect(languageList(page)).toHaveValue('de');
    const pane = settingsPane(page);
    await expect(pane.getByRole('combobox', { name: 'Interpolation in Spannweitenrichtung', exact: true })).toBeVisible();
    await expect(pane.getByRole('combobox', { name: 'Endleistenmodus', exact: true })).toBeVisible();
    await expect(pane.getByRole('combobox', { name: 'Flügelende', exact: true })).toBeVisible();
    await expect(pane.getByRole('combobox', { name: 'Parametrisierung der Profile', exact: true })).toBeVisible();
    await expect(pane.getByRole('spinbutton', { name: /^Stationen je Profilseite \(16 bis 200\)/ })).toBeVisible();
    await expect(pane.getByRole('spinbutton', { name: /^Stationen je Feld mit Leitkurve oder glatter Interpolation \(3 bis 40\)/ })).toBeVisible();
    await expect(pane.getByRole('spinbutton', { name: /^Drehpunkt der Schränkung/ })).toBeVisible();
    await expect(pane.getByRole('checkbox', { name: 'NURBS-Kontrollnetz zeigen' })).toBeVisible();
    await expect(pane.getByRole('checkbox', { name: 'Schnittkonturen zeigen' })).toBeVisible();
    await expect(pane.getByRole('checkbox', { name: TEXT.de.mirrored })).toBeVisible();

    // A German browser keeps German after a reload, and an explicit English choice beats it.
    await page.reload();
    await expectShell(page, 'de');
    await expect(statusOf(page)).toHaveText(SAMPLE.de);
    await chooseLanguage(page, 'en', 'Einstellungen');
    await page.reload();
    await expectShell(page, 'en');
    await expect(statusOf(page)).toHaveText(SAMPLE.en);
  });

  test('New opens the wizard in German; Entwurf anlegen says so in German', async ({ page }) => {
    const wizard = await openFirstRunDe(page);
    await wizard.getByRole('button', { name: 'Überspringen (Beispielflügel öffnen)' }).click();
    await expect(dialogOf(page)).toHaveCount(0);

    await button(page, 'Neu').click();
    const again = dialogOf(page);
    await expect(again.getByRole('heading', { name: 'Neuer Flügelentwurf' })).toBeVisible();
    await expect(again.getByRole('button', { name: 'Überspringen (Beispielflügel öffnen)' })).toHaveCount(0);
    await again.getByLabel('Spannweite (beide Hälften) (mm)').fill('1000');
    await expect(again.locator('p[aria-live="polite"]')).toHaveText(/^Fläche \d+,\d dm²/);
    await again.getByRole('button', { name: 'Entwurf anlegen' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(statusOf(page)).toHaveText(/^Spannweite 1\.000 mm · Fläche \d+,\d\d dm² · AR \d+,\d\d · MAC \d+,\d mm/);
    await expect(toastOf(page)).toHaveText(/^Entwurf „.+“ angelegt\.$/);

    // Abbrechen keeps the design.
    await button(page, 'Neu').click();
    await expect(dialogOf(page).getByRole('button', { name: 'Abbrechen' })).toBeVisible();
    await dialogOf(page).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(statusOf(page)).toHaveText(/^Spannweite 1\.000 mm/);
  });

  test('choosing English in a German browser: shell, status bar and a wizard opened later speak English', async ({ page }) => {
    const wizard = await openFirstRunDe(page);
    await wizard.getByRole('button', { name: 'Überspringen (Beispielflügel öffnen)' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await chooseLanguage(page, 'en', 'Einstellungen');
    await expect(statusOf(page)).toHaveText(SAMPLE.en);
    // The wizard opened after the switch speaks English, with the decimal point.
    await button(page, 'New').click();
    const again = dialogOf(page);
    await expect(again.getByRole('heading', { name: 'New wing design' })).toBeVisible();
    await expect(again.locator('p[aria-live="polite"]')).toHaveText(/^Area \d+\.\d dm², aspect ratio \d+\.\d\d, /);
    await again.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
  });
});

/** First visit of a German browser: the wizard is open. */
async function openFirstRunDe(page) {
  await page.goto('/');
  const wizard = dialogOf(page);
  await expect(wizard.getByRole('heading', { name: TEXT.de.wizardHeading })).toBeVisible();
  await expect(wizard.locator('p[aria-live="polite"]')).toHaveText(/\S/);
  return wizard;
}
