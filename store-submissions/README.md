# Wikipaidia store submission kit

Prepared for desktop version **0.11.0**, with **Michael Howard** as publisher and
**contact@michaeljasonhoward.com** as the public support contact.

## Listing materials

- [Microsoft Edge listing and certification notes](edge-listing.md)
- [Safari for macOS listing and review notes](safari-listing.md)
- [Product Hunt launch copy and media](product-hunt.md)
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

Each verified ZIP is 155,037 bytes. Rebuild and recheck the hashes after any
extension or license change. Safari store distribution can use Apple's web
packager or a signed native archive; the development helper's unsigned Debug app
is separate from the store candidate.

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

The signed native release candidate **0.11.0 (3)** was uploaded successfully on
November 2, 2026. Apple processed and validated it, and the build was selected and
saved for the App Store version. It was
archived with **Xcode 27.2 RC (27B48)** for Apple silicon and Intel. Both native
targets require **macOS 13.3**; code signatures and all 13 packaged resource files
were verified. The app and extension declare
`ITSAppUsesNonExemptEncryption=false` for their OS-provided HTTPS. See
[Safari release preparation](../SAFARI.md#prepare-a-store-archive) for requirements
and reproduction steps. This does not establish runtime testing on every
supported Mac or OS.

The web packager remains an alternative route at **global Xcode Cloud → More →
Safari Web Extension Packager**. Its two earlier export attempts failed; the
underlying cause is unknown, and the manifest warning alone does not establish it.
[Apple's packaging guide](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)

The privacy label was published on November 2. Content rights are saved as
**Yes**; the approved age-rating answers are saved with a computed **13+** rating
and the default, without an override. Three labeled WebKit fixture screenshots
are uploaded. Review contact information is saved privately, and the Paid Apps
Agreement is **Active**. Version **0.11.0, build 3** was submitted to App Review on
**November 2, 2026 at 3:01 PM America/Chicago** and is **Waiting for Review**.
Automatic release after approval is selected. Store approval remains pending.

Use the current publisher forms' definitions when completing privacy disclosures.
The listing files include the actual network and local-storage behavior to support
those answers. Account enrollment, required agreements, and store review are
separate from preparing these materials.
