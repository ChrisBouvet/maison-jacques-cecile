# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, multilingual (FR/EN/IT) marketing + booking website for "Maison Jacques & Cécile", a vacation house in Montgenèvre with two rentable apartments (`rdc` and `2eme`) plus a family-only area. No build step, no bundler, no package manager — plain HTML/CSS/JS served as-is. Deployed via GitHub Pages (custom domain in `CNAME`: `maison-jacques-cecile.fr`).

## Running / testing locally

There is no build or test command. Serve the directory with any static file server and open in a browser, e.g.:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/index.html` (or `/pages/rdc.html`, `/pages/2eme.html`, `/pages/famille.html`, `/pages/admin.html`). JS modules are loaded via native ES `import`, so the pages must be served over HTTP(S), not opened via `file://`.

There is no linter or automated test suite. Verify changes by loading the affected page(s) in a browser and checking behavior manually (see "Manual testing checklist" below).

## Architecture

**Pages** (`index.html` + `pages/*.html`) are independent static HTML documents, not a single-page app or templated site. Each page duplicates its own `<nav>`/`<footer>` markup or relies on JS to inject it (see Nav injection below). There is no server-side templating.

- `index.html` — home page, public, full nav/footer inline.
- `pages/rdc.html`, `pages/2eme.html` — public apartment pages, each with its own gallery + calendar + booking form.
- `pages/famille.html` — password-gated family area (combined calendar, per-apartment calendars, admin table). Excluded from `robots.txt`.
- `pages/admin.html` — reservation admin/management UI. Also excluded from `robots.txt`. Unlike the other pages, its logic is a large inline `<script type="module">` (not a separate JS file): it gates access with Firebase Auth Google sign-in, imports helpers from `calendar-firebase.js`/`firebase-db.js`, lazy-loads Chart.js from jsDelivr for stats, and is where the family password hash (`config/auth`) is set.
- `pages/infos.html` — practical info page.

`js/famille.js` is legacy and not loaded by any page (it holds an old hardcoded plaintext password check). The family page uses `js/famille-firebase.js`. Don't extend `famille.js`.

**Nav/footer injection**: `pages/*.html` (apartment, family and infos pages) contain empty `<nav class="nav">`/`<footer class="footer">` shells; `js/nav-partial.js` (`initNav()`/`initFooter()`) injects the actual markup at runtime with `root = '../'` relative paths, since these pages live one directory below the site root. `index.html` has its nav/footer hardcoded inline instead (it's already at root). When editing nav or footer content/links, **both** `index.html`'s inline markup and `js/nav-partial.js`'s injected templates must be updated to stay in sync.

**i18n**: No i18n framework. Every translatable string is duplicated three times inline as sibling elements tagged `data-lang="fr"|"en"|"it"`, with all but the active language given `style="display:none"`. `js/main.js`'s `setLang(lang)` toggles visibility by walking all `[data-lang]` elements and stores the choice in `localStorage['lang']`. Elements with `data-season-content` are the exception — those are managed exclusively by `js/home.js` (season-dependent content), and `setLang` explicitly skips them. When adding new user-facing text, add all three `data-lang` variants, not just French.

**Firebase (Firestore) backend** (`js/firebase-db.js`): all reservation state lives in Firestore, no other backend/API. Two collections:
- `reservations` — booking requests/bookings, fields include `apt` (`rdc`|`2eme`|`famille`), `start`/`end` (YYYY-MM-DD strings), `statut` (`en_attente`|`confirmee`|`refusee`|`famille`), `tenant`/`nom`, etc.
- `periodes_fermees` — date ranges not yet open for booking, `apt` can be a specific apartment or `"all"`.
- `config/auth` — single doc holding `familleHash`, a SHA-256 hash of the family password used to gate `pages/famille.html` (client-side check only — see `firestore.rules`, security posture is explicitly "good enough for family use", not hardened auth).

The Firebase SDK (v10.12.0) is imported straight from the `www.gstatic.com/firebasejs/` CDN. The Firebase web config in `firebase-db.js` is public client config and isn't a secret.

Firestore security rules are in `firestore.rules` at repo root. The file is meant to be pasted into the Firebase console (`console.firebase.google.com` → Firestore → Rules) and is not deployed automatically by any CI. Note that it currently only covers `reservations`, while the code also reads and writes `periodes_fermees` and `config/auth`, so the live console rules must differ from this file. Read `firestore.rules` (and ask about the live rules) before changing anything about who can read/write data.

**Calendar rendering** (`js/calendar-firebase.js`) is the core shared module:
- Maintains an in-memory store (`_store`/`_storeFerme`) fed by Firestore's `onSnapshot` realtime listeners, so all calendars on a page update live without polling.
- `FirebaseCalendar` renders a single apartment's month grid; `CombinedCalendar` renders all apartments' status as stacked bars per day (used on the family page) and overlays school holiday zone dots.
- `initCalendars()` auto-discovers `[data-calendar]` elements on the page and instantiates the right calendar class based on `data-calendar="rdc"|"2eme"|"famille"|"all"|"combined"`.
- `initResaForms()` wires up any `form.resa-form` on the page: validates against `periodes_fermees` (unless `data-bypass-ferme` is set, used on the family page), writes to Firestore via `addReservation`, and fires a non-blocking EmailJS notification (service/template/public key are hardcoded constants near the top of the file — this is a client-only integration, not a secret backend).

**School holiday zones** (`js/vacances-scolaires.js`): fetches French Zone A/B/C school holiday dates from the `data.education.gouv.fr` API, cached in `localStorage` for 7 days, with a hardcoded `FALLBACK` array used if the API is unreachable. The fallback only covers a few years — when it starts running short, extend the array with newly published official dates rather than removing the fallback mechanism.

**Photo galleries** (`js/extra-gallery.js`): each apartment has a fixed set of "named" photos (`principale`, `sejour`, `cuisine`, `chambre-1`, `chambre-2`, hardcoded in the page HTML) captioned via a per-folder `img/{rdc,2eme}/captions.json` (keyed by filename stem, each with `fr`/`en`/`it` captions). Static hosting can't list directories, so the "extra" gallery finds images by sending `HEAD` requests for `extra-1.jpg` … `extra-30.jpg` (gaps allowed; `.jpg` only, max 30). Adding a photo means dropping the file with the exact name in `img/{rdc,2eme}/` and adding its caption entry to that folder's `captions.json`. Each image folder has a `README.md` explaining this naming to non-developers.

## Conventions specific to this repo

- CSS is split by scope: `css/style.css` (shared/global), `css/home.css` (home page only), `css/apartment.css` (rdc/2eme pages), `css/famille.css` (family page). Check which stylesheet a page includes before adding rules.
- Two kinds of script loading coexist. `main.js`, `nav-partial.js` and `home.js` are classic (non-module) scripts that expose globals such as `setLang`/`initNav`. The Firebase-backed files (`apartment-firebase.js`, `famille-firebase.js`, `calendar-firebase.js`, `firebase-db.js`, `extra-gallery.js`, `vacances-scolaires.js`) are ES modules that import each other by relative path. No bundler resolves imports, so import paths must be exact and browser-loadable as-is, and you shouldn't add `import`/`export` to the classic scripts without changing their `<script>` tags on every page.
- Reservation `statut` values (`en_attente`, `confirmee`, `refusee`, `famille`) and calendar day CSS state classes (`pending`, `booked`, `reserved-family`, `ferme`) are used consistently across `calendar-firebase.js` and `famille-firebase.js` — keep new status handling consistent with the existing switch/if chains in both files rather than introducing a parallel status vocabulary.
- Dates are always plain `YYYY-MM-DD` strings (not `Date` objects) in Firestore documents and comparisons, so they sort/compare lexicographically — preserve this format when adding new date fields.

## Manual testing checklist

Since there's no automated test suite, after changes touching booking/calendar logic, manually verify in a browser:
1. Calendar renders correctly for a booked, pending, and "not yet open" (`ferme`) date range.
2. Language switch (FR/EN/IT) updates all visible text including calendar tooltips/month names.
3. Submitting `form.resa-form` on an open date range succeeds (writes to Firestore) and on a closed (`periodes_fermees`) range shows the blocking toast.
4. `pages/famille.html` password gate still unlocks with the correct password and the combined calendar reflects live Firestore changes.
