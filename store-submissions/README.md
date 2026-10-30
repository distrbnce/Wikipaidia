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
65368279101ee53579d634a96e9890653f7c7c2cfe7e585a576b4a3af73d46e5
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

For Safari, the macOS [Wikipaidia app record](https://appstoreconnect.apple.com/apps/6829067688/distribution)
has been created with app ID **6829067688**, registered bundle ID
`com.michaeljasonhoward.Wikipaidia` and SKU `wikipaidia-macos`.

The route observed in this account is **global Xcode Cloud → More → Safari Web
Extension Packager**, in the team's **Users and Access / Xcode Cloud** area; the
packager is not necessarily inside the app record's tab. The verified Safari ZIP
has been uploaded and associated with Wikipaidia. Build **0.11.0 (1)** failed
while exporting for App Store distribution. Apple's issues page requests a logs
artifact but exposes no download control; the underlying export failure remains
unknown. The unsupported-manifest-key warning alone does not establish its cause.
The refreshed candidate, including the in-panel content-license notice, was
uploaded as **0.11.0 (2)** and failed with the same export error. A local Release
archive compiled for Intel and Apple silicon with a macOS 13.0 deployment target; it is
not signed for distribution and has not been tested on every supported OS.

Three labeled WebKit fixture screenshots have been uploaded to the listing.
Version-listing metadata cannot yet be saved because App Review requires a
private reviewer phone number, which is awaiting the user. Keep that number out of public files. Once
packaging or native signing succeeds, test the resulting macOS build, finish the
metadata and privacy fields, and then submit it for review. The privacy policy URL
is saved; publishing the privacy label and completing the age-rating and content
rights declarations await publisher approval. **No App Review submission has been
made.**
[Apple's packaging guide](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)

Use the current publisher forms' definitions when completing privacy disclosures.
The listing files include the actual network and local-storage behavior to support
those answers. Account enrollment, required agreements, and store review are
separate from preparing these materials.
