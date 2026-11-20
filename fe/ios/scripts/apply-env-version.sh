#!/bin/bash
# Stamp the built app with IOS_VERSION_NAME and IOS_BUILD_NUMBER from fe/.env.
# Xcode Archive does not read .env. This phase runs after Info.plist is
# processed, so the archive and App Store upload use these values.

set -euo pipefail

ENV_FILE="${SRCROOT}/../.env"
PLIST="${TARGET_BUILD_DIR}/${INFOPLIST_PATH}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: ${ENV_FILE} not found. Set IOS_VERSION_NAME and IOS_BUILD_NUMBER there." >&2
  exit 1
fi

read_env() {
  local key="$1"
  local line val
  line=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  val="${line#*=}"
  val="$(printf '%s' "$val" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/')"
  printf '%s' "$val"
}

VERSION_NAME="$(read_env IOS_VERSION_NAME)"
BUILD_NUMBER="$(read_env IOS_BUILD_NUMBER)"

if [[ -z "$VERSION_NAME" ]]; then
  echo "error: IOS_VERSION_NAME is missing in ${ENV_FILE}" >&2
  exit 1
fi
if [[ -z "$BUILD_NUMBER" ]]; then
  echo "error: IOS_BUILD_NUMBER is missing in ${ENV_FILE}" >&2
  exit 1
fi
if [[ ! "$BUILD_NUMBER" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
  echo "error: IOS_BUILD_NUMBER must be a number like 2 or 2.0.1, got '${BUILD_NUMBER}'" >&2
  exit 1
fi

if [[ ! -f "$PLIST" ]]; then
  echo "error: built Info.plist not found at ${PLIST}" >&2
  exit 1
fi

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${VERSION_NAME}" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${BUILD_NUMBER}" "$PLIST"

echo "Applied iOS version from .env: ${VERSION_NAME} (${BUILD_NUMBER})"
