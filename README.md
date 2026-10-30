# Wikipaidia

A browser extension for desktop Safari, Chrome, and Microsoft Edge that flags
disclosed paid involvement on English Wikipedia.

## Inspiration

Wikipaidia was inspired by **Pablo Torre Finds Out**, specifically
[this episode at 27:45](https://www.youtube.com/watch?v=SzgQWv71a2E&t=1665s).
That segment prompted this project: making public paid-editing disclosures easier
to find while reading Wikipedia.

This is an independent project with no affiliation with or endorsement from
Pablo Torre Finds Out, Wikipedia, or the Wikimedia Foundation.

## Try it

Download the ZIP for your browser from the
[latest GitHub release](https://github.com/distrbnce/Wikipaidia/releases/latest),
then follow the installation steps below. You can also use this repository's
`extension/` folder directly.

The setup below uses local developer loading. Safari, Chrome, and Edge share the
same [`extension`](extension/) source; store submission is a separate distribution
step.

### Chrome and Edge

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode**, then choose **Load unpacked**.
3. Select this repository's [`extension`](extension/) folder. If using a ZIP from
   `npm run package`, extract `Wikipaidia-Chrome-<version>.zip` or
   `Wikipaidia-Edge-<version>.zip` first and select the folder containing
   `manifest.json`.
4. Open the browser's **Extensions** menu and pin/show Wikipaidia on the toolbar.
5. Allow site access to **en.wikipedia.org**, then reload an English Wikipedia
   article. Click Wikipaidia's toolbar icon to open the evidence panel.

After source changes, reload Wikipaidia on the extensions page and reload the
article. [CHROMIUM.md](CHROMIUM.md) has browser-specific steps and official guides.

### Safari

1. Open Safari **Settings → Advanced → Show features for web developers**.
2. Open **Settings → Developer → Add Temporary Extension…** and select the
   [`extension`](extension/) folder, or `Wikipaidia-Safari-<version>.zip` produced by
   `npm run package`.
3. Enable Wikipaidia in **Settings → Extensions** and allow **en.wikipedia.org**.
4. Reload an English Wikipedia article. A notice appears at the top when paid
   involvement is found. Click it to see evidence. Try one of the
   [example articles below](#example-articles).

Temporary loading is available in current Safari and expires after 24 hours or
when Safari quits. [SAFARI.md](SAFARI.md) covers native app builds and older Safari.

### Use the panel

In the panel header, choose **Banner** or **Page Tint**, then pick an alert color.
Both choices are saved locally and apply to other open articles. The same color
controls the banner and page tint. Tint mode keeps a small evidence icon
at the top; its overlay does not block links or text selection. Only paid disclosures
and paid-content notices activate these page alerts. Other COI notices and unverified
payment concerns remain in the panel.

Use the browser toolbar extension button to open the panel or change alert style on
an article with no findings.

### Example articles

After enabling Wikipaidia, open any article below to try the page alert and
evidence panel. Each row describes what to look for and links to the supporting
talk-page revision.

| Article | What to try | Supporting notice |
| --- | --- | --- |
| [BP](https://en.wikipedia.org/wiki/BP) | Three paid-contributor cards and grouped COI edit requests. | [Source](https://en.wikipedia.org/w/index.php?title=Talk%3ABP&oldid=1370681720) |
| [Vivek Ramaswamy](https://en.wikipedia.org/wiki/Vivek_Ramaswamy) | Two paid-contributor cards and separate general COI notices. | [Source](https://en.wikipedia.org/w/index.php?title=Talk%3AVivek%20Ramaswamy&oldid=1382857147) |
| [Subway](https://en.wikipedia.org/wiki/Subway_(restaurant)) | Two paid-contributor cards. | [Source](https://en.wikipedia.org/w/index.php?title=Talk:Subway_(restaurant)&oldid=1382811405) |
| [Amway](https://en.wikipedia.org/wiki/Amway) | A paid disclosure alongside a separate general COI notice. | [Source](https://en.wikipedia.org/w/index.php?title=Talk:Amway&oldid=1291886505) |
| [Cisco](https://en.wikipedia.org/wiki/Cisco) | A paid disclosure and grouped COI edit requests. | [Source](https://en.wikipedia.org/w/index.php?title=Talk:Cisco&oldid=1382111110) |
| [Coca-Cola](https://en.wikipedia.org/wiki/Coca-Cola) | A paid disclosure and a COI edit request. | [Source](https://en.wikipedia.org/w/index.php?title=Talk:Coca-Cola&oldid=1379194687) |
| [MTV](https://en.wikipedia.org/wiki/MTV) | A simple single-contributor example. | [Source](https://en.wikipedia.org/w/index.php?title=Talk:MTV&oldid=1381171871) |
| [Quantum computing](https://en.wikipedia.org/wiki/Quantum_computing) | A paid disclosure naming an agency, Beutler Ink. | [Source](https://en.wikipedia.org/w/index.php?title=Talk:Quantum_computing&oldid=1379513429) |
| [United States Postal Service](https://en.wikipedia.org/wiki/United_States_Postal_Service) | A paid disclosure plus grouped edit requests. | [Source](https://en.wikipedia.org/w/index.php?title=Talk:United_States_Postal_Service&oldid=1375337566) |

These examples returned paid-disclosure findings in a basic scan on
**October 30, 2026**. Live notices and results can change. The notices document
publicly declared involvement; they do not establish which current sentences were
paid for. Start with **Subway, Amway, and Cisco** to compare different card types.

## What this version does

- Automatically reads the current article and its talk page through the public
  English Wikipedia API.
- Recognizes `Connected contributor (paid)`, article-specific user-page `Paid`
  declarations, paid-contribution cleanup notices, community concerns about
  undisclosed payment, and separate general COI notices. Verified common template
  redirects are included.
- Each disclosure has a tinted type header, linked **Editor:** and **Employer:**
  fields, and source links. Explicit employer wikilinks keep their original target;
  plain employer names link to Wikipedia search. Evidence links name the notice
  and its source page, with the source-page update date below. They open the exact
  snapshot; revision numbers remain in their tooltips. That date describes the
  source page version, not when the paid relationship began or was disclosed.
  Following an evidence link highlights the matching editor's entry or notice
  in that saved page and scrolls it into view. Source pages use the same
  English Wikipedia permission and do not run another article scan. If the
  matching notice cannot be located, the page shows a short status message.
  Click any evidence header to collapse or expand its section. Sections start
  expanded and keep their state while additional sources and edits load.
- Opening the panel automatically shows each paid contributor's three latest
  direct article edits, including their change previews. **See X more edits**
  expands the rest; **See fewer edits** returns to three. Duplicate disclosures
  share history and diff requests. Larger expanded histories load change text as
  their rows approach the viewport.
  Placeholders reserve space while the history and previews load. The panel keeps
  its size, reading position, and expanded paragraphs during background updates.
  The edit date and Wikipedia diff link appear on one line. Each preview
  combines removals and additions in one inline comparison, with
  inverse red/green highlights on changed characters. Shared context appears once.
  By default it shows about 55 characters around each change; **See More...**
  inside the text box reveals the full retained text, and **See Less...** returns
  to the snippet.
  Paragraphs retain up to 20,000 characters; a direct diff link covers larger changes.
  These account edits are not automatically proven paid. No direct matches may mean
  work happened in drafts or edit requests.
- Remaining edit counts come from paginated public article history. Each lookup
  reads at most 20 pages of 500 metadata revisions; if more remain, **Load more
  edits** resumes the lookup without inventing an exact total.
- **Check more sources** checks up to five standard talk archives from a
  bounded list of 100 subpage titles and up to eight public user pages, prioritizing
  people named in notices and then editors from the latest 50 article revisions.
  User-page payment declarations must explicitly name the article to become a
  finding. It adds findings without replacing existing cards or reloading their
  edits. A fresh cached basic check supplies the current-source snapshot, so only
  additional sources are fetched.
- Current Wikipedia account blocks appear directly below the editor's name as
  **User Blocked**, with **On:** and **Duration:** labels. The reason links to an
  English Wikipedia reference supplied after “Please see:” when available.
  Historical disclosure flags do not establish a current block; a block does not
  establish that an edit was paid.
- Keeps paid involvement, nonpaid COI, and community allegations visibly distinct.
- COI cards explain the recorded connection, or say when the relationship is
  unspecified. Declared-connection links and discussion sections remain available.
  Historical COI edit requests from one source page are grouped, with their topics,
  discussion excerpts and marked outcomes. An answered request is not treated as
  evidence of implementation or payment.

## Deliberate limits

This is a template-based disclosure reader, not an undisclosed-payment detector.
Free-form prose disclosures, substituted/transcluded notices, arbitrary template
wrappers, edit-summary disclosures, nonstandard/older archives, and historical user
pages are not fully analyzed. “No disclosure found” means only that the checked
sources had no recognized finding.

A notice can be added by another editor. It is evidence of a public declaration or
notice, not independent proof of a financial transaction. A paid relationship does
not prove that every edit was paid, that the article is biased, or that a proposal
was accepted. A COI request's answered state is never treated as proof of payment
or implementation. This version does not identify surviving paid-origin sentences
or automatically connect a paid person's request to a volunteer's article edit.

The panel also makes clear when viewing an older article revision: its disclosure
sources are current and may describe another period.

## Privacy and permissions

Read the [privacy policy](PRIVACY.md) for details or visit
[support](store-submissions/support.md) for help.

- Only `https://en.wikipedia.org/*` access and the `storage` permission.
- No account, backend, telemetry, external model, or analytics.
- Requests go directly to the public English Wikipedia API with login credentials
  omitted. It receives article/user-page titles and ordinary network information.
- Up to 30 scan results are cached locally in browser session storage and may be
  reused for 15 minutes. Expired entries can remain until eviction or the browser
  session ends; the session cache is cleared when that session ends. Storage
  failures do not prevent a check.
- Only your alert-style and color preferences are kept in persistent local extension storage.
- Public wikitext is rendered as text. Source links are restricted to HTTPS
  English Wikipedia URLs. Nothing edits or posts to Wikipedia.

## Development

Node 20+ is needed for tests and packaging; the extension has no runtime
dependencies and no bundling step.

```sh
npm ci
npx playwright install chromium webkit
npm run check
npm test
npm run test:browser
npm run test:extension
npm run test:webkit
npm run package
```

`test:browser` uses Playwright's bundled Chromium. The same fixture-based UI
checks can run in installed desktop Google Chrome or Microsoft Edge:

```sh
npm run test:chrome
npm run test:edge
```

These UI tests inject the content script with mocked extension APIs; they check
rendering and interaction in each browser. `test:webkit` checks WebKit rendering.
`test:extension` loads the real extension in bundled Chromium with an isolated
temporary profile and verifies its worker and messaging. Chrome and Edge have
removed the command-line flags used for automated extension loading, so that test
uses bundled Chromium, as recommended by
[Playwright](https://playwright.dev/docs/chrome-extensions).
Browser tests use fictional fixtures and do not call Wikipedia. Optional live API
check: `node scripts/smoke-live.mjs BP` (add `--deep` for the bounded deeper scan).
Screenshots are written to `test-results/`.

`npm run package` writes Chrome, Edge, and Safari ZIPs to `dist/`, each containing
the same extension source. These are developer-loading packages. Chrome and Edge
load the extracted folders; Safari also supports its temporary-extension ZIP flow.

`extension/` is the source of truth. The Safari build helper generates the ignored
native wrapper in `safari/Wikipaidia/` before compiling the unsigned development
app. Run `npm run build:safari` on macOS with full Xcode installed. This local
version is not signed or notarized. The API client identifier includes the project
URL for maintainer contact. Store distribution requires the appropriate review
and signing steps.

GitHub Actions runs source checks, unit tests, browser fixture tests, Chromium
extension integration tests, and ZIP packaging for pushes and pull requests. See
[CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, and contribution guidance.

## How the pieces fit

`content.js` adds an isolated Shadow DOM panel. `diff-model.js` builds merged inline
comparisons and contextual snippets. The panel asks the module background
worker to scan an article. `wiki-api.js` reads public source; `scanner.js` enforces
scope and limits; `evidence.js` recognizes balanced template invocations without
executing wikitext. Results carry their exact source links into the panel.

## Sources

- [Wikimedia Terms of Use](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#4._Refraining_from_Certain_Activities)
- [English Wikipedia paid-contribution disclosure](https://en.wikipedia.org/wiki/Wikipedia:Paid-contribution_disclosure)
- [Connected contributor (paid) documentation](https://en.wikipedia.org/wiki/Template:Connected_contributor_(paid)/doc)
- [MediaWiki API access policy](https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy)
- [Apple: Running your Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
- [Google: Load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
- [Microsoft: Sideload an extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)

Code is available under the MIT license. Wikipedia source text remains under its
applicable license; evidence links provide source and contributor attribution.
