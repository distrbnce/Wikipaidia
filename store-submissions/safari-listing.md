# Mac App Store listing — Wikipaidia 0.11.0

Updated November 2, 2026 for the completed **0.11.0** source. Local validation
passed 113 unit tests, 44 Chrome interface checks, 44 WebKit interface checks and
13 installed-extension checks in bundled Chromium. The attribution update also
passed focused Chrome/WebKit checks. Native archive checks are recorded below.

This submission targets **Safari on macOS only**. It does not claim iPhone, iPad
or visionOS support. Use `dist/Wikipaidia-Safari-0.11.0.zip` with Apple's web
packager, or create a store-signed build from the same completed release source.
The verified ZIP is 155,037 bytes and contains 13 files including `LICENSE`.
SHA-256: `65368279101ee53579d634a96e9890653f7c7c2cfe7e585a576b4a3af73d46e5`.
The current store candidate is the signed native **0.11.0 (3)** archive, uploaded
successfully on November 2. Apple processed and validated it, and the build was
selected and saved for the App Store version. It was submitted to App Review on
**November 2, 2026 at 3:01 PM America/Chicago** and is **Waiting for Review**.

## Current App Store Connect status

- macOS app record: [Wikipaidia, app ID 6829067688](https://appstoreconnect.apple.com/apps/6829067688/distribution).
- Registered bundle ID: `com.michaeljasonhoward.Wikipaidia`.
- Registered SKU: `wikipaidia-macos`.
- Signed native release candidate **0.11.0 (3)** uploaded successfully, processed,
  validated and selected for the App Store version. The universal Release archive
  was built with **Xcode 27.2 RC (27B48)**. Both native targets require **macOS
  13.3**, and their code signatures and all 13 packaged resource files were
  verified. This does not claim runtime testing on every supported Mac or OS.
- Both native targets declare `ITSAppUsesNonExemptEncryption=false` for OS-only
  HTTPS. [Safari release preparation](../SAFARI.md#prepare-a-store-archive) explains
  the Safari 16.4 module requirement and export-compliance declaration.
- The two web-packager export attempts failed. Their underlying cause remains
  unknown; the unsupported-manifest-key warning is not a confirmed cause.
- Three labeled WebKit fixture screenshots have been uploaded to the listing.
  These are demonstration captures, not native Safari screenshots.
- Version metadata and review contact information are saved. Private reviewer
  contact details must not be written into public files.
- The privacy policy URL is saved and the privacy label was published November 2.
  Content rights are saved as **Yes**. Approved age-rating answers are saved,
  producing **13+** with the default setting and no override.
- The Paid Apps Agreement is **Active**.
- **Submitted November 2, 2026 at 3:01 PM America/Chicago; Waiting for Review.**
  Automatic release after approval is selected. Apple has not yet approved or
  published this store version.

## App Store fields

| Field | Value |
| --- | --- |
| Name | Wikipaidia |
| Subtitle | Wikipedia disclosure reader |
| Platform | macOS only |
| Version | 0.11.0, build 3; submitted and Waiting for Review |
| Primary language | English (United States) |
| Primary category | Utilities; keep the packaged app category consistent |
| Publisher/seller display name | Michael Howard; verified in the user's signed-in Apple account |
| Public support email | contact@michaeljasonhoward.com |
| Marketing URL | https://github.com/distrbnce/Wikipaidia |
| Support URL | https://github.com/distrbnce/Wikipaidia/blob/main/store-submissions/support.md |
| Issue tracker | https://github.com/distrbnce/Wikipaidia/issues |
| Privacy policy URL | https://github.com/distrbnce/Wikipaidia/blob/main/PRIVACY.md |
| Copyright | 2026 Wikipaidia contributors; consistent with the published MIT license |
| Review contact name | Michael Howard |
| Review contact phone | Saved privately in App Store Connect; do not copy into public files |
| Review contact email | contact@michaeljasonhoward.com, unless the user supplies a separate review contact |
| Sign-in required | No |
| Bundle ID | com.michaeljasonhoward.Wikipaidia |
| SKU | wikipaidia-macos |
| App Store Connect app ID | 6829067688 |
| App Store Connect URL | https://appstoreconnect.apple.com/apps/6829067688/distribution |
| Minimum macOS version | 13.3 in both native targets; Safari 16.4 or later required |
| Age rating | Computed 13+; approved answers saved, default setting with no override |

Apple allows up to 30 characters each for name and subtitle; these values use
10 and 27. [App information limits](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)

### Promotional text — 170-character maximum

```text
See public paid-editing disclosures while reading English Wikipedia in Safari. Open source links and compare a named contributor's article edits.
```

### Description — 4,000-character maximum; paste as plain text

```text
Wikipaidia makes public paid-editing disclosures easier to find while you read English Wikipedia in Safari on your Mac.

Enable the Safari extension and allow access to en.wikipedia.org. When an article has a recognized paid-contributor disclosure or paid-content notice, Wikipaidia adds a page alert. Click the alert or the Safari toolbar button to open the evidence panel.

Features:
• View recognized disclosures on the current article and its talk page, with named editors, employers and links to the exact supporting source revisions when available.
• Follow an evidence/source link to the saved page to highlight the matching editor entry or notice and scroll it into view. A short status message appears if the match cannot be located.
• Review a named contributor's direct article edits using linked dates and change previews. These account edits are not automatically proven paid.
• Keep paid involvement, general conflicts of interest and unverified payment concerns visibly distinct.
• Check a bounded set of standard talk archives and public user pages using “Check more sources.” User-page declarations must explicitly name the article.
• Choose a banner or page tint and an alert color. Your choices are saved locally.
• Open the panel from the Safari toolbar even when no recognized finding is present.

Understand the limits
Wikipaidia reads recognized disclosure templates. It cannot detect undisclosed payments, determine whether an article is biased, identify surviving paid-origin sentences or prove that an edit request was implemented. “No disclosure found” means no recognized finding was found in the sources checked. Notices can be historical or added by another editor; they are not independent proof of a financial transaction. Disclosure sources are current even when you view an older article revision.

Privacy
The extension requests access only to en.wikipedia.org and extension storage. It sends the article title and requested public source-page titles directly to the English Wikipedia API, omitting Wikipedia login credentials. Wikipedia receives normal network request information. Alert style and color stay locally. Up to 30 recent scan results may be stored in browser session storage and reused for 15 minutes. Older entries may remain until replaced or the browser session ends. There is no publisher backend, account, telemetry or analytics.

Wikipaidia is an independent open-source project, with no affiliation with or endorsement from Wikipedia, the Wikimedia Foundation or Pablo Torre Finds Out. Source code, project background and support are available through the GitHub repository.
```

### Keywords — at most 100 bytes, comma separated

```text
paid editing,disclosures,transparency,conflict of interest,research,source evidence
```

The keywords above use 83 ASCII bytes. Apple also limits review notes to 4,000
bytes. Promotional text, descriptions and keyword limits are documented in
[Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/).

### What's New

Apple does not expose this field for an app's first store version. If the account
already has an existing store version and this is an update, use only a change
summary verified against that earlier store build and the completed 0.11 build.

## Packaging and build selection

The user has an Apple Developer account and the macOS app record above has been
created. The route observed in this account is **global Xcode Cloud → More →
Safari Web Extension Packager**, in the team's **Users and Access / Xcode Cloud**
area. Do not rely on the packager being inside the app record's Xcode Cloud tab.

1. For a native release, follow [Safari release preparation](../SAFARI.md#prepare-a-store-archive)
   to archive, verify and upload the signed app. Build **0.11.0 (3)** has completed
   upload and processing in the existing macOS
   [Wikipaidia app record](https://appstoreconnect.apple.com/apps/6829067688/distribution).
2. Inspect any processing issues and test the available native build through
   TestFlight before selecting it for review. Browser fixture checks do not test
   the installed Safari background worker.
3. Complete required agreements and version metadata, keeping reviewer contact
   information private. For this submission, the Paid Apps Agreement is Active;
   metadata, privacy label, content rights and age-rating answers are saved, and
   three labeled WebKit fixture screenshots are uploaded.
4. Select and save the processed build, click **Add for Review**, then confirm
   **Submit for Review** in the draft submission. Version **0.11.0 (3)** completed
   these steps on November 2 and is **Waiting for Review**, with automatic release
   after approval selected. Monitor App Review for requests or a decision.

Alternatively, upload the verified source ZIP through the web packager and inspect
its result. It packages the extension into a containing app; the repository's
unsigned Debug app is a separate development artifact. Earlier web-packager
exports failed, so this candidate uses the documented native signing/upload route.
[Apple's Safari web packager workflow](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)

## Review notes — paste as plain text

```text
Wikipaidia 0.11.0 is a Safari Web Extension for macOS. No account, sign-in, subscription or test credentials are required. Internet access to en.wikipedia.org is needed. The containing app exists to install and enable the Safari extension; the main interface appears on English Wikipedia pages.

1. Install and open Wikipaidia, then open Safari Settings > Extensions. Enable Wikipaidia and allow it to access en.wikipedia.org. If Safari requests website permission from the toolbar, grant access and reload the article.
2. Visit https://en.wikipedia.org/wiki/BP. A page alert appears if a recognized paid disclosure or paid-content notice is currently present. Click it or the Safari toolbar button to open the evidence panel.
3. Also visit https://en.wikipedia.org/wiki/Vivek_Ramaswamy and https://en.wikipedia.org/wiki/Subway_(restaurant). They are live public examples, not fixed fixtures. Subway is useful for comparing multiple contributor cards when those notices are present, but notices may change before review.
4. Open an evidence/source link to inspect the exact public source revision. The page highlights the matching editor entry or notice and scrolls it into view, or shows a short status message if it cannot locate the match. The source-page update date is not the start date of a paid relationship. Inspect a named contributor's linked direct article edits and previews; the extension does not claim those account edits were automatically paid.
5. In the panel header, switch Alert style between Banner and Page Tint and choose an alert color. The settings persist locally and apply to other open articles. Page Tint preserves links and text selection.
6. Select “Check more sources” to check a bounded set of standard talk archives and public user pages. Its results depend on the live public source pages.
7. Open the toolbar panel on another English Wikipedia article. A page without recognized findings remains usable. General COI notices and unverified concerns stay distinct and do not activate paid page alerts.

The extension is read-only with respect to Wikipedia. All executable JavaScript is packaged locally; fetched Wikipedia data is not executable code. The only manifest permissions are storage and https://en.wikipedia.org/*. API requests go directly to the public English Wikipedia API with login credentials omitted. The publisher has no backend, analytics or telemetry. Up to 30 recent scan results may be stored in browser session storage and reused for 15 minutes; older entries may remain until replaced or the session ends. Alert preferences persist locally. Opening a source link is a normal Wikipedia visit subject to the browser's login settings.

This release reads recognized disclosure templates, does not detect undisclosed payments and does not identify surviving paid-origin text. If a live example changes, follow its source links or try another example rather than expecting fixed findings.
```

## Privacy answers and permissions

Single-purpose summary, if requested:

```text
Show recognized public paid-editing disclosures and their supporting evidence while the user reads an English Wikipedia article.
```

The privacy label was published on November 2, 2026. Reassess it against the
policy and Apple's current definitions when data practices change. A missing
publisher backend alone is not a basis to choose **Data Not Collected**. The
current article title, requested public source titles, contributor account names
and revision IDs travel directly to Wikipedia; requests expose ordinary network
information such as the reader's IP address. Alert preferences and the bounded
check cache stay on the device. Wikipedia login credentials are omitted.

The 15-minute cache limit governs reuse, not deletion. Older entries can remain
until replaced or the session ends. Evidence links may contain a fragment with
source and notice identifiers. The fragment is read locally to highlight the
matching notice, without another API request, but can remain in browser history
or saved links; the visited page can also read its fragment. Opening that link is
a normal page visit subject to the browser's settings and Wikipedia login state.

Apple defines collection in terms of off-device transmission and access beyond
servicing a real-time request, and separately defines third-party partners. Use
the actual data flow and external service handling when maintaining the label.
[Apple's app privacy definitions](https://developer.apple.com/app-store/app-privacy-details/)

Permission explanations, if requested by App Review:

| Permission | Explanation |
| --- | --- |
| `storage` | Remember alert style/color locally and keep a bounded session cache of source-check results. |
| `https://en.wikipedia.org/*` | Determine the active article title, add its evidence interface, retrieve the public disclosures/revisions/edit previews needed for that article and highlight the matching notice on linked source pages. |
| Remote executable code | None. Executable code is packaged with the extension; Wikipedia content is treated as data. |

## Screenshots

Supply genuine captures of version 0.11.0 running in **Safari on macOS**. Apple
requires one to ten screenshots, JPEG/JPG/PNG, with no alpha channel or
transparency. Accepted Mac sizes are **1280 × 800**, **1440 × 900**,
**2560 × 1600** or **2880 × 1800** pixels, all 16:10.
[Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

Suggested captures: BP evidence; Subway editor/employer/source cards; page tint
and header controls. Show only what the completed, verified release actually displays. Do
not label Chromium fixture screenshots as Safari screenshots.
