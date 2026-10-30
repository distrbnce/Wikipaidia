# Contributing to Wikipaidia

Wikipaidia helps readers find public paid-editing disclosures on English Wikipedia.
Changes should keep source evidence visible and distinguish paid disclosures,
general conflicts of interest, and community allegations.

## Local setup

Use Node.js 20 or newer. Safari and the optional native app build require macOS;
the parser, API client, unit tests, and packaging work without Xcode.

```sh
git clone https://github.com/distrbnce/Wikipaidia.git
cd Wikipaidia
npm ci
npx playwright install --with-deps chromium webkit
npm run check
npm test
WIKIPAIDIA_BROWSER=webkit npm run test:browser
npm run test:extension
npm run package
```

`test:browser` defaults to an installed Google Chrome on macOS. Use
`WIKIPAIDIA_BROWSER=webkit` for Playwright's WebKit, or set
`WIKIPAIDIA_CHROME_PATH` to a Chrome/Chromium executable. `test:extension` uses
Playwright's bundled Chromium; leave `WIKIPAIDIA_CHROME_PATH` unset for that test.
The tests use fictional fixtures and do not query live Wikipedia.

To test the extension in Safari or build its unsigned macOS container, follow
[SAFARI.md](SAFARI.md). Edit files in `extension/`; the build helper regenerates
`safari/Wikipaidia/`. Generated native files, packages, browser profiles, screenshots,
and dependency folders should stay out of commits.

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

Use the repository's issue forms. Include your macOS/Safari version, steps to
reproduce, and expected behavior. If a disclosure is misread, link the public
source revision or provide a small fictional wikitext example. Explain what the
source actually establishes. Avoid including private information or browsing
history beyond what is needed to reproduce the issue.

Contributions are made under the repository's [MIT license](LICENSE). Wikipedia
material retains its own applicable license and attribution requirements.
