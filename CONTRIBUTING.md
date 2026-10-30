# Contributing to Wikipaidia

Wikipaidia helps readers find public paid-editing disclosures on English Wikipedia.
Changes should keep source evidence visible and distinguish paid disclosures,
general conflicts of interest, and community allegations.

## Local setup

Use Node.js 20 or newer. Desktop Chrome and Edge use the common web-extension
source on their supported operating systems. Safari and its optional native app
build require macOS; source checks, unit tests, and ZIP packaging work without
Xcode.

```sh
git clone https://github.com/distrbnce/Wikipaidia.git
cd Wikipaidia
npm ci
npx playwright install --with-deps chromium webkit
npm run check
npm test
npm run test:browser
npm run test:webkit
npm run test:extension
npm run package
```

`test:browser` defaults to Playwright's bundled Chromium. To run the same UI
fixtures in installed desktop browsers:

```sh
npm run test:chrome
npm run test:edge
```

The Chrome and Edge aliases select Playwright's `chrome` and `msedge` channels;
`test:webkit` selects WebKit. `WIKIPAIDIA_BROWSER` also accepts `chromium`, `chrome`,
`msedge`, or `webkit` when calling `test:browser` directly.
`WIKIPAIDIA_CHROME_PATH` can override the executable for Chromium-family UI
fixtures; leave it unset when checking the standard Chrome or Edge channel.

UI fixture tests inject the content script with mocked extension APIs. The
separate `test:extension` suite loads the real extension in Playwright's bundled
Chromium, testing the worker, scanner, and messaging in an isolated profile. Leave
`WIKIPAIDIA_CHROME_PATH` unset for that test. Both branded Chrome and Edge removed
the command-line extension-loading flags; see
[Playwright's extension testing guidance](https://playwright.dev/docs/chrome-extensions).
The browser suites use fictional fixtures and do not query live Wikipedia.

For manual loading in desktop Chrome or Edge, follow [CHROMIUM.md](CHROMIUM.md).
For Safari and its unsigned macOS container, follow [SAFARI.md](SAFARI.md).
`npm run package` creates `Wikipaidia-Chrome-<version>.zip`,
`Wikipaidia-Edge-<version>.zip`, and `Wikipaidia-Safari-<version>.zip` in `dist/`.
Each contains the same extension source; extract the Chrome/Edge ZIP before using
**Load unpacked**. These packages support local developer loading.

Edit files in `extension/`; the Safari build helper regenerates `safari/Wikipaidia/`.
Generated native files, packages, browser profiles, screenshots, and dependency
folders should stay out of commits.

## Before opening a pull request

- Describe the reader-visible change and how you checked it.
- Run `npm run check`, `npm test`, and the relevant browser suites. Keep
  `package-lock.json` in sync when dependencies or package metadata change.
- Add or adjust focused fixtures when changing disclosure recognition, API
  boundaries, or evidence rendering. Preserve links to exact source revisions.
- Keep network access read-only and limited to English Wikipedia. Changes to
  permissions, stored data, or external requests must be explained in the PR and
  reflected in the README's privacy section.
- Do not describe an editor's entire contribution history as paid, infer payment
  from an account block, or treat an answered edit request as proof of acceptance.

## Reporting problems and requesting features

Use the repository's issue forms. Include your operating system and browser
(Safari, Chrome, or Edge) versions, steps to reproduce, and expected behavior.
If a disclosure is misread, link the public
source revision or provide a small fictional wikitext example. Explain what the
source actually establishes. Avoid including private information or browsing
history beyond what is needed to reproduce the issue.

Contributions are made under the repository's [MIT license](LICENSE). Wikipedia
material retains its own applicable license and attribution requirements.
