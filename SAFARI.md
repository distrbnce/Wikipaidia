# Safari development

Wikipaidia targets Safari on macOS. Its web-extension source is in `extension/`.
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
WIKIPAIDIA_DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer ./scripts/build-safari.sh
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

Apple documentation:

- [Running your Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
- [Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
- [Managing Safari web extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions)
