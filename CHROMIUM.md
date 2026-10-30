# Chrome and Microsoft Edge

Wikipaidia uses the same Manifest V3 extension source in desktop Chrome, Microsoft
Edge, and Safari. Chrome and Edge support local developer loading of the
[`extension`](extension/) folder. This guide covers that workflow; store submission
is a separate distribution step.

## Choose a source folder

Use this repository's `extension/` folder directly, or generate packages:

```sh
npm ci
npm run package
```

Extract `dist/Wikipaidia-Chrome-<version>.zip` for Chrome or
`dist/Wikipaidia-Edge-<version>.zip` for Edge. Select the extracted folder containing
`manifest.json`, not the ZIP file or the whole repository. Both packages contain
the same extension source. Keep the loaded folder in place while using it.

## Load in Chrome

1. Enter `chrome://extensions` in the address bar.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the source folder described above.
4. Open the **Extensions** toolbar menu and pin Wikipaidia.

Google documents the [unpacked extension and toolbar pinning workflow](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Load in Edge

1. Enter `edge://extensions` in the address bar.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the source folder described above.
4. Open the **Extensions** menu and show/pin Wikipaidia on the toolbar.

Microsoft documents [local extension installation](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading).

## Allow Wikipedia access and open the panel

Open an article on **en.wikipedia.org**. In Wikipaidia's extension settings, allow
site access for `https://en.wikipedia.org/*`, then reload the article. The extension
requests only English Wikipedia access and local storage. The browser's site-access
controls are described by [Google](https://support.google.com/chrome/answer/2664769?hl=en)
and [Microsoft](https://support.microsoft.com/en-us/edge/change-site-access-permissions-for-extensions-in-microsoft-edge).

Paid disclosures trigger a page alert. Click that alert or Wikipaidia's toolbar
icon to open the panel. The toolbar also opens it when no alert is present and
lets you change the banner/tint preference and color.

After changing source files or replacing an extracted package, use **Reload** on
Wikipaidia's card at `chrome://extensions` or `edge://extensions`, then reload open
Wikipedia articles. See Google's [extension reload guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#reload)
or Microsoft's [local update guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading#locally-updating-an-extension-reload).

## Check the installed extension

Use normal **Developer mode → Load unpacked** in each browser for this manual
checklist. It exercises the installed extension beyond the mocked UI fixtures:

- Reload an English Wikipedia article after allowing site access. Check that the
  extensions page reports no extension errors.
- Click Wikipaidia's toolbar icon and confirm the panel opens, including on an
  article with no recognized disclosure.
- On an article with a recognized paid notice, check the page alert, contributor
  details, and evidence links against the public source revision. Live Wikipedia
  disclosures can change.
- Expand article edit previews and open a source/diff link. Confirm Wikipedia
  links still work and the article text remains selectable.
- Switch between **Banner** and **Page Tint**, change the alert color, and reload
  the article. Confirm the saved preference applies. After a source update, reload
  the extension and the article again.

## Automated checks

`npm run test:chrome` and `npm run test:edge` run UI fixtures in installed Chrome
and Edge. These inject the content script with mocked extension APIs. The separate
`npm run test:extension` loads the actual extension in Playwright's bundled
Chromium to check the worker and messaging. Chrome and Edge removed command-line
extension-loading flags; [Playwright recommends bundled Chromium](https://playwright.dev/docs/chrome-extensions)
for this integration test. Manual **Load unpacked** remains the setup above.

See [CONTRIBUTING.md](CONTRIBUTING.md) for browser installation and test commands,
or [SAFARI.md](SAFARI.md) for Safari setup.
