# Store image assets

Run `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/wikipaidia-playwright node scripts/capture-store-assets.mjs`
from the repository root, or set the browser cache path appropriate to your machine.
Install Playwright's Chromium and WebKit first if needed. Node.js and the repository's
existing Playwright development dependency are used; no production data is fetched.

The `chromium/` and `webkit/` folders each contain three **1280×800 opaque RGB PNGs**:

- `01-banner.png`: the page alert on an illustrative article.
- `02-evidence-and-edits.png`: the actual evidence panel and inline edit comparisons.
- `03-page-tint.png`: the actual page-tint preference applied to the article.

The evidence-panel images use its normal scroll position at the bottom so the
complete Wikipedia license/attribution note is visible. The interface layout and
controls are unchanged.

These screenshots render the current extension source with **visibly identified,
fictional example data**, using isolated Playwright browser contexts. They show the
actual interface, not a redrawn mockup. The capture does not contact Wikipedia or
use the user's browser profile. Chromium rendering is not an assertion that the
image was captured in branded Microsoft Edge; WebKit rendering is not an assertion
that it was captured in branded Safari. Review the generated images in the publisher
dashboard before submission. Each engine's `capture.json` records its version and
SHA-256 hashes of the extension scripts used.

The images have no browser toolbar or fabricated browser branding. The dimensions
fit Edge's 1280×800 screenshot option and Apple's macOS 1280×800 screenshot option.
The WebKit screenshot's opaque alpha channel is removed losslessly; pixels are not
resized, redrawn, or recolored.

`extension-icon-128.png` is a byte-for-byte copy of the existing extension icon.
`edge-logo-300.png` and `safari-app-icon-1024.png` use the same code-native monogram
geometry as `scripts/generate-icons.py`. The 1024px app icon is composited onto
white and has no alpha channel. These are listing assets; they do not modify the
extension's runtime icons or package.
