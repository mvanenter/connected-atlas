# The Connected Atlas — #30DayMapChallenge Day 16

An interactive, mobile-friendly global collaborative map on GitHub Pages, powered by a public Google Form and a **moderated public-only Google Sheets tab**. No paid GIS software, server or API key required.

## 1. Create the Google Form

Go to https://forms.google.com/ and create a form titled **Where in the World Are We?**.

Use these **exact questions** (question names matter for the linked Google Sheet):

1. **Nickname** — short answer, required. Tell contributors to use an alias, not their full name.
2. **Country** — short answer, required.
3. **Latitude** — short answer, required. WGS84 decimal degrees; examples `-43.5`, `35.7`.
4. **Longitude** — short answer, required. WGS84 decimal degrees; examples `172.6`, `139.7`.
5. **Note** — paragraph, optional; e.g. `I love maps because…` (200 characters suggested).
6. **Consent** — multiple choice with **Yes** as the only choice, required. Explain that nickname, country, approximate coordinates and note may be published openly.

Add a description: **This is a public collaborative map. Submit an approximate town/city location or public landmark, NEVER your home, workplace or another precise personal location. The map will show the submitted point and an illustrative 10 km radius. This is not location anonymisation: choose an approximate point before submitting. Submissions are reviewed before publication; your contribution can be removed on request.** Add your contact email to the description for removal requests.

In Form Settings, do **not** collect email addresses and do not require sign-in (if your Google account allows). Avoid restricting submissions to one per Google account. Publish the form for respondents and copy the **responder link** (not the editor link).

## 2. Link Google Forms to Google Sheets

In the Form, choose **Responses → Link to Sheets** and create a spreadsheet.

The linked `Form Responses 1` worksheet will have these columns:

| Column | Heading |
|---|---|
| A | Timestamp |
| B | Nickname |
| C | Country |
| D | Latitude |
| E | Longitude |
| F | Note |
| G | Consent |

In column **H1**, type `Approved`. After reviewing any row, insert a checkbox in its H cell and tick it to approve; alternatively type `TRUE`. Do not publish this raw-response tab.

### Create the safe public tab

Create a new worksheet (tab) called `Public Map` in the **same spreadsheet**. In row 1, type the exact five headers:

`nickname | country | latitude | longitude | note`

In cell **A2**, paste this formula:

```excel
=IFERROR(FILTER({'Form Responses 1'!B2:B,'Form Responses 1'!C2:C,'Form Responses 1'!D2:D,'Form Responses 1'!E2:E,'Form Responses 1'!F2:F},'Form Responses 1'!H2:H=TRUE,'Form Responses 1'!G2:G="Yes"),"")
```

This only exposes reviewed rows where the participant also agreed to publish their information. (Some regional spreadsheet settings use `;` rather than `,` as formula separators.)

**Important privacy limitation:** The approved coordinates themselves will be public. A 10 km circle does not hide the submitted point. Review coordinates and reject any entries that look too precise or residential; ask contributors to select a town centre or intentionally approximate location. If you need stronger privacy guarantees, generalise the coordinates in the public sheet and do not publish the originals.

### Publish only `Public Map` as CSV

In Google Sheets, choose **File → Share → Publish to web**. Choose the **`Public Map` worksheet** (not Entire document and not `Form Responses 1`), and **Comma-separated values (.csv)** as the format. Click Publish and copy the URL. It normally resembles:

`https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=123456789&single=true&output=csv`

**Do not set the private response spreadsheet to “Anyone with the link can edit”.** Publishing the `Public Map` tab as CSV is enough. Note that Google Sheets publishing may be cached, so updates are not truly instant.

For stricter separation, copy approved/generalised records into a standalone public-only spreadsheet instead of publishing a worksheet from the response spreadsheet.

## 3. Connect the website

Open `config.js` and paste:

```javascript
window.MAP_CONFIG = {
  siteTitle: 'Where in the World Are We?',
  formUrl: 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform',
  csvUrl: 'https://docs.google.com/spreadsheets/d/e/YOUR_PUBLISHED_ID/pub?gid=YOUR_PUBLIC_TAB_GID&single=true&output=csv',
  refreshMilliseconds: 90000,
  radiusMetres: 10000,
  showDemoIfNotConfigured: true
};
```

The website uses `fetch()` to read the CSV and updates every 90 seconds. There is no API key. The published CSV may be cached by Google. The page **never writes into Google Sheets**: new submissions enter through the Form.

## 4. Publish on GitHub Pages

1. Create a **public** GitHub repository, e.g. `connected-atlas`.
2. Upload these files to its top level: `index.html`, `app.js`, `config.js`, `style.css`, `.nojekyll`, `README.md`.
3. Go to **Settings → Pages → Build and deployment**.
4. Under Source choose **Deploy from a branch**; choose **main**, folder **/(root)**, and Save.
5. Once published, the URL will usually be `https://YOUR_USERNAME.github.io/connected-atlas/`.

The page opens in demo mode with six clearly labelled **fictitious example contributors** until you supply the published CSV link. These demo points are not real submissions.

## 5. Test before sharing

- Open the public Form in a private/incognito browser session. Confirm no Google sign-in is required.
- Submit an alias and intentionally approximate coordinates (e.g., a city centre). Check the row appears in `Form Responses 1`.
- Confirm the marker is **not** shown before approval.
- Tick `Approved` on that response row, then check that it appears in `Public Map`.
- Open the published CSV URL directly and make sure it contains **only** the five approved public columns (no emails, timestamps or consent metadata).
- Open the GitHub Pages site, refresh, test markers, search, mobile layout and participation link.
- Test a malformed coordinate, a quoted comma in a note and HTML-like text to confirm the UI stays safe.
- Test removing approval: the record should disappear once Google's published CSV refreshes.

## Troubleshooting

- **Demo points still visible:** `csvUrl` is empty, or `config.js` was not saved/deployed.
- **Could not load contributions:** The URL was not published as CSV, wrong tab selected, Sheets publishing restricted, or network/CORS issue. Open browser DevTools Console and Network.
- **No approved contributions:** Confirm exact column order, Consent = `Yes`, and Approved = `TRUE`.
- **Wrong map point:** Check Longitude = X and Latitude = Y, in WGS84 decimal degrees. A minus sign matters.
- **Changes delayed:** A combination of site polling (90 seconds) and Google Sheets published-data caching can delay updates.
- **Continent count:** Shows a dash unless an optional `continent` column is added to `Public Map`. The number of countries remains fully functional without it.

## Sources / credits

- Leaflet: https://leafletjs.com/
- OpenStreetMap contributors: https://www.openstreetmap.org/copyright
- CARTO basemap: https://carto.com/attributions
- GitHub Pages docs: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Google Sheets publishing instructions: https://support.google.com/docs/answer/183965

MIT-licensed project scaffold. Contributions are owned by their respective authors.
