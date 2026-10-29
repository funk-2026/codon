#!/bin/bash
set -e

# ==============================================================================
# Codon - Local iOS Build & TestFlight Upload Script (for macOS)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$FE_DIR"

echo "📱 Applying version from fe/.env..."
node scripts/apply-env-version.js ios

echo "📦 Installing CocoaPods..."
cd ios
pod install --repo-update
cd "$FE_DIR"

mkdir -p build

echo "🏗️ Building and archiving Codon with Xcode..."
xcodebuild archive \
  -workspace ios/Codon.xcworkspace \
  -scheme Codon \
  -configuration Release \
  -archivePath build/Codon.xcarchive \
  -allowProvisioningUpdates \
  CODE_SIGNING_ALLOWED=YES

echo "📦 Exporting IPA..."
xcodebuild -exportArchive \
  -archivePath build/Codon.xcarchive \
  -exportPath build/ \
  -exportOptionsPlist ios/ExportOptions.plist \
  -allowProvisioningUpdates

echo "✅ IPA generated successfully at: $FE_DIR/build/Codon.ipa"

if [ "$1" == "--upload" ]; then
  if [ -z "$ASC_KEY_ID" ] || [ -z "$ASC_ISSUER_ID" ]; then
    echo "⚠️ To auto-upload, please set ASC_KEY_ID and ASC_ISSUER_ID environment variables,"
    echo "   or upload fe/build/Codon.ipa using Apple's Transporter app from the Mac App Store."
    exit 1
  fi
  echo "🚀 Uploading Codon.ipa to App Store Connect / TestFlight..."
  xcrun altool --upload-app \
    -f build/Codon.ipa \
    -t ios \
    --apiKey "$ASC_KEY_ID" \
    --apiIssuer "$ASC_ISSUER_ID"
  echo "🎉 Upload to TestFlight complete!"
fi
