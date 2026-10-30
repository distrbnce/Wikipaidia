# Wikipaidia store submission kit

Prepared for desktop version **0.11.0**, with **Michael Howard** as publisher and
**contact@michaeljasonhoward.com** as the public support contact.

## Listing materials

- [Microsoft Edge listing and certification notes](edge-listing.md)
- [Safari for macOS listing and review notes](safari-listing.md)
- [Public support page](support.md)
- [Public privacy policy](../PRIVACY.md)
- [Screenshots, icons, and capture details](assets/README.md)

Public URLs for the publisher forms:

| Field | URL |
| --- | --- |
| Website | https://github.com/distrbnce/Wikipaidia |
| Support | https://github.com/distrbnce/Wikipaidia/blob/main/store-submissions/support.md |
| Privacy policy | https://github.com/distrbnce/Wikipaidia/blob/main/PRIVACY.md |

## Packages

Run `npm run package` to create the browser ZIPs in `dist/`. Upload
`Wikipaidia-Edge-0.11.0.zip` to Microsoft Partner Center and
`Wikipaidia-Safari-0.11.0.zip` to Apple's Safari Web Extension Packager. Each
contains the same 12 extension files and the MIT license, with `manifest.json` at
the archive root.

Both verified packages have SHA-256:

```text
4a8feab06cb1ac7c4b2a90b4c59ad3f7433ccff6d6d6be68b434e800e0586e5f
```

Rebuild and recheck the hashes after any extension or license change. The native
unsigned Debug app is a development build; the Safari ZIP goes through Apple's
packaging and store-review workflow.

## Local validation

On October 30, 2026, version 0.11.0 passed source checks, 113 unit tests, 44 Chrome
UI checks, 44 WebKit UI checks, and 13 installed-extension checks in bundled
Chromium. The ZIP entries, version, license, and source bytes were verified.
These checks do not constitute Microsoft or Apple certification. The image guide
records which rendering engine produced each screenshot and identifies the
fictional demonstration data.

## Publisher workflows

For Edge, create a Microsoft Edge developer account in Partner Center, upload the
Edge ZIP, fill in the listing and privacy fields, and submit for certification.
[Microsoft's publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

For Safari, create a macOS app record in App Store Connect, then use **Xcode Cloud
→ Safari Web Extension Packager** to upload the Safari ZIP. Check and test the
generated build, complete the store metadata and privacy fields, and submit the
macOS build for review.
[Apple's packaging guide](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)

Use the current publisher forms' definitions when completing privacy disclosures.
The listing files include the actual network and local-storage behavior to support
those answers. Account enrollment, required agreements, and store review are
separate from preparing these materials.
