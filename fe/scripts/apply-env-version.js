#!/usr/bin/env node

/**
 * apply-env-version.js
 *
 * Reads version configurations from fe/.env and synchronizes them into app.json
 * and native build configurations (e.g. android/app/build.gradle) for store releases.
 *
 * Usage:
 *   node scripts/apply-env-version.js android
 *   node scripts/apply-env-version.js ios
 */

const fs = require('fs');
const path = require('path');

const platform = (process.argv[2] || '').toLowerCase();
if (platform !== 'android' && platform !== 'ios') {
  console.error('❌ Error: Platform argument required. Specify "android" or "ios".');
  process.exit(1);
}

// 1. Locate and parse fe/.env
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    }
  });
}

// 2. Read app.json
const appJsonPath = path.join(rootDir, 'app.json');
if (!fs.existsSync(appJsonPath)) {
  console.error('❌ Error: app.json not found at ' + appJsonPath);
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
if (!appJson.expo) appJson.expo = {};
if (!appJson.expo.android) appJson.expo.android = {};
if (!appJson.expo.ios) appJson.expo.ios = {};

let versionName = '';
let buildIdentifier = '';

if (platform === 'android') {
  versionName =
    process.env.INPUT_VERSION_NAME ||
    envVars.ANDROID_VERSION_NAME ||
    process.env.ANDROID_VERSION_NAME ||
    appJson.expo.version ||
    '1.0.0';

  const rawCode =
    process.env.INPUT_VERSION_CODE ||
    envVars.ANDROID_VERSION_CODE ||
    process.env.ANDROID_VERSION_CODE ||
    appJson.expo.android.versionCode ||
    1;

  const versionCode = parseInt(rawCode, 10);
  if (isNaN(versionCode) || versionCode <= 0) {
    console.error(`❌ Error: Invalid ANDROID_VERSION_CODE "${rawCode}". Must be a positive integer.`);
    process.exit(1);
  }

  buildIdentifier = String(versionCode);
  appJson.expo.version = versionName;
  appJson.expo.android.versionCode = versionCode;

  // Also sync android/app/build.gradle if present
  const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
  if (fs.existsSync(gradlePath)) {
    let gradle = fs.readFileSync(gradlePath, 'utf8');
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
    gradle = gradle.replace(/versionName\s+["'][^"']+["']/, `versionName "${versionName}"`);
    fs.writeFileSync(gradlePath, gradle, 'utf8');
    console.log(`✅ Synced android/app/build.gradle -> versionCode ${versionCode}, versionName "${versionName}"`);
  }
} else if (platform === 'ios') {
  versionName =
    process.env.INPUT_VERSION_NAME ||
    envVars.IOS_VERSION_NAME ||
    process.env.IOS_VERSION_NAME ||
    appJson.expo.version ||
    '1.0.0';

  const rawBuild =
    process.env.INPUT_BUILD_NUMBER ||
    envVars.IOS_BUILD_NUMBER ||
    process.env.IOS_BUILD_NUMBER ||
    appJson.expo.ios.buildNumber ||
    '1';

  buildIdentifier = String(rawBuild).trim();
  appJson.expo.version = versionName;
  appJson.expo.ios.buildNumber = buildIdentifier;

  // Also sync native iOS Info.plist if present
  const infoPlistPath = path.join(rootDir, 'ios', 'Codon', 'Info.plist');
  if (fs.existsSync(infoPlistPath)) {
    let plist = fs.readFileSync(infoPlistPath, 'utf8');
    plist = plist.replace(
      /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${versionName}$2`
    );
    plist = plist.replace(
      /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${buildIdentifier}$2`
    );
    fs.writeFileSync(infoPlistPath, plist, 'utf8');
    console.log(`✅ Synced ios/Codon/Info.plist -> CFBundleShortVersionString "${versionName}", CFBundleVersion "${buildIdentifier}"`);
  }
}

// 3. Save app.json
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
console.log(`✅ Updated app.json:`);
console.log(`   - Platform:     ${platform}`);
console.log(`   - Version Name: ${versionName}`);
console.log(`   - Build/Code:   ${buildIdentifier}`);

// 4. Export to GitHub Actions environment if running in CI
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `version_name=${versionName}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `version_code=${buildIdentifier}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `build_number=${buildIdentifier}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `full_version=${versionName} (${buildIdentifier})\n`);
}
if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, `APP_VERSION_NAME=${versionName}\n`);
  fs.appendFileSync(process.env.GITHUB_ENV, `APP_BUILD_IDENTIFIER=${buildIdentifier}\n`);
}

