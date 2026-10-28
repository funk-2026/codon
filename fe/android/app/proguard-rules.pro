# ─────────────────────────────────────────────────────────────────────────────
# ProGuard / R8 DEX Code Optimization Rules for Codon (React Native / Expo)
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Bytecode & DEX Optimization Settings ──────────────────────────────────
# Enable multi-pass optimization and access modification for deeper method inlining
-optimizationpasses 5
-allowaccessmodification
-mergeinterfacesaggressively
-dontpreverify

# Keep line numbers and source file names for crash analytics / stack traces
-keepattributes SourceFile,LineNumberTable,EnclosingMethod,InnerClasses,Signature,*Annotation*

# ── 2. React Native Core & JNI ────────────────────────────────────────────────
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip

# Do not strip any class or member annotated with @DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# Preserve native JNI methods for React Native C++ bridge
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
