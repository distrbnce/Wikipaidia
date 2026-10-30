# Microsoft Edge Add-ons listing — Wikipaidia 0.11.0

Prepared October 30, 2026 for the completed **0.11.0** source. Source checks,
113 unit tests, 44 installed-Chrome interface checks and 13 bundled-Chromium
installed-extension checks passed. Microsoft Edge was not installed locally;
these checks do not establish that Edge-specific review has been completed.

Verified package: `dist/Wikipaidia-Edge-0.11.0.zip`, 155,037 bytes, 13 files
including `LICENSE`.
SHA-256: `65368279101ee53579d634a96e9890653f7c7c2cfe7e585a576b4a3af73d46e5`.
Publisher registration and store certification remain separate steps.

## Listing fields

| Field | Value |
| --- | --- |
| Extension name | Wikipaidia |
| Package version | 0.11.0 |
| Language | English (United States) / en-US |
| Category | Productivity, if available in the publisher form |
| Publisher display name | Michael Howard |
| Public support email | contact@michaeljasonhoward.com |
| Website | https://github.com/distrbnce/Wikipaidia |
| Support URL | https://github.com/distrbnce/Wikipaidia/blob/main/store-submissions/support.md |
| Issue tracker | https://github.com/distrbnce/Wikipaidia/issues |
| Privacy policy URL | https://github.com/distrbnce/Wikipaidia/blob/main/PRIVACY.md — verify the finalized policy is public before submission |
| Promotional video | Leave empty; the inspiration episode is not an extension demonstration |

The name and short description come from the uploaded manifest; changing them
requires a new package. Microsoft requires a long description of 250–10,000
characters. The seven optional search terms may total at most 21 words, with at
most 30 characters per term. [Microsoft's submission fields](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

### Short description — exact published manifest value

```text
Shows disclosed paid involvement on English Wikipedia.
```

This is 54 characters, below the 132-character manifest-description limit
documented by the Chromium manifest reference to which Microsoft's manifest
documentation refers. [Manifest description reference](https://developer.chrome.com/docs/extensions/reference/manifest/description)

### Long description — paste as plain text

```text
Wikipaidia makes public paid-editing disclosures easier to find while you read English Wikipedia in Microsoft Edge.

When an article has a recognized paid-contributor disclosure or paid-content notice, Wikipaidia adds a page alert. Open it to see the supporting public evidence and links to the exact source revisions. Choose a banner or page tint and select your alert color.

Features:
• Read recognized disclosures on the current article and its talk page.
• See named editors, employers and source links when the notice provides them.
• Follow an evidence/source link to the saved page, where Wikipaidia highlights the matching editor entry or notice and scrolls it into view. If it cannot locate the match, it shows a short status message.
• Review a named contributor's direct article edits with linked dates and change previews. These account edits are not automatically proven paid.
• Keep paid involvement, general conflicts of interest and unverified payment concerns visibly distinct.
• Choose “Check more sources” to check a bounded set of standard talk archives and public user pages. User-page declarations must explicitly name the article.
• Open the panel from the toolbar even when an article has no findings.

Wikipaidia is a template-based disclosure reader. It does not detect undisclosed payments, determine whether an article is biased, identify surviving paid-origin sentences or prove that an edit request was implemented. “No disclosure found” means no recognized finding was found in the sources checked. Disclosures and notices can be historical or added by another editor; they are not independent proof of a financial transaction. When you view an older article revision, the disclosure sources remain current.

The extension requests access only to en.wikipedia.org and extension storage. It sends article and public source-page titles directly to the English Wikipedia API, without Wikipedia login credentials. Alert style and color stay locally. Up to 30 recent scan results may be stored in browser session storage and reused for up to 15 minutes. The reuse limit does not delete old results: entries may remain until replaced or the session ends. There is no publisher backend, account, telemetry or analytics.

This is an independent open-source project, with no affiliation with or endorsement from Wikipedia, the Wikimedia Foundation or Pablo Torre Finds Out. Project background, source code and support are available through the GitHub repository.
```

### Search terms — enter separately

- Wikipedia disclosures
- paid editing
- transparency
- conflict of interest
- source evidence
- research
- open source

## Privacy-page fields

### Single purpose

```text
Show recognized public paid-editing disclosures and their supporting evidence while the user reads an English Wikipedia article.
```

### Permission justification: storage

```text
Store the user's alert-style and color preferences locally and keep up to 30 recent scan results in browser session storage. Cached results may be reused for up to 15 minutes; older entries may remain until replaced or the browser session ends. Session storage is cleared when the session ends. These preferences and cached results are not sent to a publisher server.
```

### Permission justification: https://en.wikipedia.org/*

```text
Read the active English Wikipedia article title, display its alert and evidence panel, and request public disclosures, source revisions, contributor status, article edit history and change previews from the English Wikipedia API. On a linked source page, locate and highlight the matching notice without another API request. Access is restricted to en.wikipedia.org; the extension does not read other websites, edit Wikipedia or send Wikipedia login credentials with API requests.
```

### Remote code

Select **No, I am not using remote code** for the verified 0.11.0 package.

```text
All executable JavaScript is included in the extension package. Wikipedia responses are public data used by the packaged parser and interface, not downloaded executable code. The package does not load remote scripts, execute fetched wikitext or call a remote model.
```

### Data usage narrative and final-form guidance

```text
Wikipaidia reads the current English Wikipedia article title and sends it, along with requested public source-page titles, contributor account names and revision identifiers, directly to the English Wikipedia API for the requested disclosure and edit-history features. Wikipedia receives normal network request information, including the user's IP address. API requests omit Wikipedia login credentials and referrer information. The publisher operates no receiving backend and adds no telemetry, analytics or advertising. Alert preferences and a bounded session cache remain in browser storage; cached results can be reused for up to 15 minutes, but old entries may remain until replaced or the session ends. Evidence links may include a fragment identifying the source and matching notice. The fragment is read locally for highlighting, without another API request; it can remain in browser history or saved links, and the visited page can read it. Opening a source link is a normal Wikipedia visit subject to the browser's settings and login state.
```

Do not infer “no user data” from the absence of a publisher backend. Compare the
live form's definitions with the final privacy policy, including its treatment of
visited-page titles and public website content transmitted to Wikipedia. Use the
data-category and limited-use answers prepared with that policy; do not claim
that nothing ever leaves the device. The contact email above is support contact
information, not extension-collected reader identity.

## Notes for certification — paste as plain text

```text
Wikipaidia 0.11.0 is a desktop Microsoft Edge extension. It requires no account, sign-in, subscription or test credentials. A network connection to en.wikipedia.org is required.

1. Enable Wikipaidia and allow site access to https://en.wikipedia.org/*. Pin or show it in the Edge toolbar if needed.
2. Visit https://en.wikipedia.org/wiki/BP and reload after granting access. If a recognized paid disclosure is currently present, a page alert appears. Click it, or click the toolbar button, to open the evidence panel.
3. Also test https://en.wikipedia.org/wiki/Vivek_Ramaswamy and https://en.wikipedia.org/wiki/Subway_(restaurant). These are public examples rather than fixed test fixtures. Subway is useful for comparing multiple contributor cards when those notices are present; live notices can change.
4. Open an evidence/source link to inspect the exact public source revision. The linked page highlights the matching editor entry or notice and scrolls it into view. If the match cannot be located, a short status message appears. The source-page update date is not the start date of a paid relationship. On a paid-contributor card, inspect the linked article edits and their previews; those account edits are not claimed to be paid automatically.
5. Change Alert style between Banner and Page Tint, choose a color, and reload or open another article. The preferences persist locally. Page Tint leaves links and text selection usable.
6. Select “Check more sources” for the optional bounded archive/user-page scan. Its additional findings depend on the public pages at review time.
7. On an article without recognized paid findings, use the toolbar button to open the panel. General COI notices and unverified concerns do not activate paid page alerts. No finding does not mean no paid editing occurred.

The extension makes no Wikipedia edits and has no remote executable code. The website permission is en.wikipedia.org only; storage holds local preferences and up to 30 recent scan results. Cached results can be reused for 15 minutes; older entries may remain until replaced or the session ends. API requests go directly to Wikipedia with credentials omitted. Normal source-page visits follow the browser's login settings. If sources change, inspect the linked source revisions and try another example instead of expecting a fixed card count.
```

## Required and optional images

Use genuine captures of version 0.11.0 in Microsoft Edge; do
not submit mock screens or images showing unfinished features. Microsoft's current specifications
are a square logo, preferably 300 × 300 pixels (minimum 128 × 128); up to six
optional screenshots at 640 × 480 or 1280 × 800; optional small tile 440 × 280;
optional large tile 1400 × 560 PNG. [Microsoft's image specifications](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

Suggested captures: page alert and evidence on BP; editor/employer/source cards
on Subway; page tint with the style/color controls. Capture whichever current
public evidence the verified release actually displays.
