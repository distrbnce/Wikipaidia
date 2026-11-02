# Safari development

Wikipaidia requires **Safari 16.4 or later** on macOS. Its web-extension source is
in `extension/`.
The build helper generates a macOS container for that same extension in
`safari/Wikipaidia/`. This directory is ignored by Git; a fresh checkout creates it
on the first native build. No Apple Developer account is needed for local unsigned
testing.

## Quickest local test

Recent Safari versions can temporarily load the extension folder directly:

1. Open **Safari > Settings > Advanced**, and enable **Show features for web developers**.
2. In **Settings > Developer**, click **Add Temporary Extension…**.
3. Authenticate Safari's unsigned-extension prompt when requested, then select this
   repository's `extension` folder (the folder containing `manifest.json`).
4. In **Settings > Extensions**, enable Wikipaidia and allow it on
   **en.wikipedia.org**. Reload an English Wikipedia article.

Safari removes temporary extensions after 24 hours or when you quit Safari. Use
the extension's **Reload** control in Safari Settings after changing its files.
If your Safari version does not show **Add Temporary Extension…**, use the native
app workflow below.

## Build the native macOS app

Install full Xcode, then run from the repository root:

```sh
./scripts/build-safari.sh
```

The script regenerates `safari/Wikipaidia/` using Apple's Safari Web Extension
packager and copies the current `extension/` files into it before building. Make
extension changes in `extension/`, not the generated copies. Regeneration replaces
the generated project, so keep any intended native-app customizations in a
separate source or update the build helper first.

The unsigned debug app is written to:

```text
build/safari/Build/Products/Debug/Wikipaidia.app
```

To regenerate just the Xcode project without building:

```sh
./scripts/build-safari.sh --project-only
```

The helper uses your explicit `DEVELOPER_DIR` if set, otherwise an installed Xcode
or Xcode beta. To choose a specific Xcode installation:

```sh
WIKIPAIDIA_DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer ./scripts/build-safari.sh
```

## Enable the unsigned native build

1. Open the built **Wikipaidia.app** once, or open
   `safari/Wikipaidia/Wikipaidia.xcodeproj` and run the **Wikipaidia** scheme.
2. In **Safari > Settings > Advanced**, enable **Show features for web developers**.
3. In **Settings > Developer**, enable **Allow unsigned extensions**. Safari may
   ask you to authenticate. This setting resets when Safari quits.
4. In **Settings > Extensions**, enable Wikipaidia and allow access to
   **en.wikipedia.org**. Reload the article after granting website access.

The extension only requests English Wikipedia access. Safari's website permission
must be allowed for the article button and evidence panel to appear. To update the
native build, rerun `./scripts/build-safari.sh`, then reopen the built app as needed.

Signing and App Store distribution are separate release steps. This repository's
development helper does not select a signing identity, change Safari settings,
install the extension, or publish anything.

## Prepare a store archive

The helper generates a development project. Before archiving for the store:

1. Generate the project with `./scripts/build-safari.sh --project-only` and open
   it in an Xcode version accepted by App Store Connect. Configure the registered
   app and extension bundle identifiers, signing team, release version and a new
   build number in both targets. Keep the generated Swift wrapper's extension
   identifier constant consistent with the registered extension bundle ID.
2. Set **both native targets' macOS deployment target to 13.3 or later**. The
   extension's static ES-module imports require `background.type: "module"`,
   supported since Safari 16.4. Keep that manifest value even if a converter
   reports it as unsupported. [WebKit's Safari 16.4 module support](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/#background-modules)
3. With only OS-provided HTTPS and no non-exempt encryption, set
   `ITSAppUsesNonExemptEncryption` to Boolean `false` in both Info.plists. This
   declares no **non-exempt** encryption; it does not mean HTTPS is absent.
   Reassess if encryption use changes. [Apple's encryption guidance](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption)
4. Archive a signed **Release** build for both `arm64` and `x86_64`. Verify both
   native signatures, deployment targets and versions, and compare all 13
   packaged resources (the 12 extension files plus `LICENSE`) byte for byte with
   the release source. Use Xcode Organizer's distribution workflow to upload it,
   then inspect App Store Connect processing and test the installed Safari
   extension before choosing the build for review.

The **0.11.0 (3)** release candidate was archived with **Xcode 27.2 RC (27B48)**,
with the settings and resource/signature checks above, and uploaded successfully
on November 2, 2026. Apple processed and validated the build. It was selected and
saved for the App Store version and submitted at **3:01 PM America/Chicago** that
day; its status is **Waiting for Review**, with automatic release after approval
selected. Archive checks do not establish runtime testing on every supported Mac
or OS. Current listing status is in the
[Safari submission notes](store-submissions/safari-listing.md).

Apple documentation:

- [Running your Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
- [Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
- [Managing Safari web extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions)
- [Distributing your Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)
