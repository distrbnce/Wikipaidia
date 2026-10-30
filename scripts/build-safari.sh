#!/bin/bash
# Regenerate the native wrapper from the current extension sources, then build it.
set -euo pipefail

WIKIPAIDIA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIKIPAIDIA_MODE="${1:-build}"

if [[ "$WIKIPAIDIA_MODE" != "build" && "$WIKIPAIDIA_MODE" != "--project-only" ]]; then
  echo "Usage: $0 [--project-only]" >&2
  exit 2
fi

if [[ ! -f "$WIKIPAIDIA_ROOT/extension/manifest.json" ]]; then
  echo "Missing extension/manifest.json." >&2
  exit 1
fi

# An explicit developer directory takes precedence. The local beta is also useful
# when the selected Xcode is on a disconnected external volume.
if [[ -n "${WIKIPAIDIA_DEVELOPER_DIR:-}" ]]; then
  export DEVELOPER_DIR="$WIKIPAIDIA_DEVELOPER_DIR"
elif [[ -z "${DEVELOPER_DIR:-}" ]]; then
  if [[ -x /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild ]]; then
    export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  elif [[ -x /Applications/Xcode-beta.app/Contents/Developer/usr/bin/xcodebuild ]]; then
    export DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer
  fi
fi

if ! WIKIPAIDIA_PACKAGER="$(xcrun --find safari-web-extension-packager 2>/dev/null)"; then
  if ! WIKIPAIDIA_PACKAGER="$(xcrun --find safari-web-extension-converter 2>/dev/null)"; then
    echo "Install full Xcode, or set WIKIPAIDIA_DEVELOPER_DIR to its Contents/Developer folder." >&2
    exit 1
  fi
fi

mkdir -p "$WIKIPAIDIA_ROOT/safari"
"$WIKIPAIDIA_PACKAGER" "$WIKIPAIDIA_ROOT/extension" \
  --project-location "$WIKIPAIDIA_ROOT/safari" \
  --app-name Wikipaidia \
  --bundle-identifier app.Wikipaidia \
  --macos-only --swift --copy-resources --no-open --no-prompt --force

WIKIPAIDIA_PROJECT="$WIKIPAIDIA_ROOT/safari/Wikipaidia/Wikipaidia.xcodeproj"
if [[ ! -d "$WIKIPAIDIA_PROJECT" ]]; then
  echo "The Safari packager did not generate the expected project: $WIKIPAIDIA_PROJECT" >&2
  exit 1
fi

if [[ "$WIKIPAIDIA_MODE" == "--project-only" ]]; then
  echo "Generated: $WIKIPAIDIA_PROJECT"
  exit 0
fi

xcodebuild -project "$WIKIPAIDIA_PROJECT" -scheme Wikipaidia \
  -configuration Debug -destination 'platform=macOS' \
  -derivedDataPath "$WIKIPAIDIA_ROOT/build/safari" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build

echo "Built unsigned app: $WIKIPAIDIA_ROOT/build/safari/Build/Products/Debug/Wikipaidia.app"
echo "See SAFARI.md for enabling this local development build in Safari."
