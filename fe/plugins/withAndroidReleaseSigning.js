const { withAppBuildGradle, withProjectBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RELEASE_SIGNING_CONFIG = `
        release {
            if (System.getenv("KEYSTORE_FILE") && file(System.getenv("KEYSTORE_FILE")).exists()) {
                storeFile file(System.getenv("KEYSTORE_FILE"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            } else if (file('release.keystore').exists()) {
                storeFile file('release.keystore')
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

const PROGUARD_RULES = `# ─────────────────────────────────────────────────────────────────────────────
# ProGuard / R8 DEX Code Optimization Rules for Codon (React Native / Expo)
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Bytecode & DEX Optimization Settings ──────────────────────────────────
-optimizationpasses 5
-allowaccessmodification
-mergeinterfacesaggressively
-dontpreverify

-keepattributes SourceFile,LineNumberTable,EnclosingMethod,InnerClasses,Signature,*Annotation*

# ── 2. React Native Core & JNI ────────────────────────────────────────────────
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip

-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

-keepclassmembers class * {
    native <methods>;
}

-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.JavaScriptModule { *; }
-keep class com.facebook.react.bridge.NativeModule { *; }
-keep class com.facebook.react.bridge.WritableMap { *; }
-keep class com.facebook.react.bridge.ReadableMap { *; }
-keep class com.facebook.react.bridge.WritableArray { *; }
-keep class com.facebook.react.bridge.ReadableArray { *; }

# ── 3. Hermes Engine & SoLoader ───────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.soloader.** { *; }
-dontwarn com.facebook.soloader.**

# ── 4. Expo Modules Architecture ─────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class * extends expo.modules.kotlin.modules.Module { *; }
-keep class * extends expo.modules.core.interfaces.LifecycleEventListener { *; }
-keepclassmembers class * extends expo.modules.kotlin.modules.Module {
    public <init>(...);
}
-keep class expo.modules.core.** { *; }
-keep interface expo.modules.core.** { *; }
-dontwarn expo.modules.**

# ── 5. React Native Reanimated & Screens & Gesture Handler ───────────────────
-keep class com.swmansion.reanimated.** { *; }
-keepclassmembers class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# ── 6. Storage & Networking (AsyncStorage, SecureStore, OkHttp) ───────────────
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# ── 7. React Native SVG & Media (Expo Video, Expo Image) ──────────────────────
-keep class com.horcrux.svg.** { *; }
-keep class com.facebook.imagepipeline.** { *; }
-dontwarn com.facebook.imagepipeline.**

# ── 8. Kotlin Coroutines & Reflection ─────────────────────────────────────────
-dontwarn kotlin.reflect.**
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}
`;

function withAndroidReleaseSigning(config) {
  // 1. Configure android/app/build.gradle
  config = withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    // Ensure multiDexEnabled true
    if (!contents.includes('multiDexEnabled true')) {
      contents = contents.replace(
        /defaultConfig\s*\{/,
        'defaultConfig {\n        multiDexEnabled true'
      );
    }

    // Ensure signingConfigs.release exists
    if (!contents.includes('storeFile file(System.getenv("KEYSTORE_FILE"))')) {
      if (contents.includes('signingConfigs {')) {
        contents = contents.replace(
          /(signingConfigs\s*\{[\s\S]*?debug\s*\{[^}]*?\})/,
          (match) => match + RELEASE_SIGNING_CONFIG
        );
      }
    }

    // Ensure release buildType uses signingConfig signingConfigs.release (only inside release { ... })
    contents = contents.replace(
      /(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release'
    );

    // Ensure shrinkResources defaults to true
    contents = contents.replace(
      /android\.enableShrinkResourcesInReleaseBuilds'\)\s*\?:\s*'false'/,
      "android.enableShrinkResourcesInReleaseBuilds') ?: 'true'"
    );

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // 2. Configure android/build.gradle to keep AGP 8.8.2 pinned
  config = withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (contents.includes("classpath('com.android.tools.build:gradle')")) {
      contents = contents.replace(
        "classpath('com.android.tools.build:gradle')",
        "classpath('com.android.tools.build:gradle:8.8.2')"
      );
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // 3. Ensure custom proguard rules are retained
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const proguardPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );
      if (fs.existsSync(proguardPath)) {
        const existing = fs.readFileSync(proguardPath, 'utf8');
        if (!existing.includes('# ProGuard / R8 DEX Code Optimization Rules')) {
          fs.writeFileSync(proguardPath, `${PROGUARD_RULES}\n${existing}`, 'utf8');
        }
      }
      return modConfig;
    },
  ]);

  return config;
}

module.exports = withAndroidReleaseSigning;
