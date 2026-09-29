internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    let superResult = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // After super returns, scenes are connected — start React Native now
    DispatchQueue.main.async {
      self.startReactNative(launchOptions: launchOptions)
    }

    return superResult
  }

  private func startReactNative(launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
    guard let factory = reactNativeFactory else { return }

    let windowScene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first(where: { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive })

    if let windowScene = windowScene {
      let win = UIWindow(windowScene: windowScene)
      self.window = win
      factory.startReactNative(withModuleName: "main", in: win, launchOptions: launchOptions)
    } else {
      // Fallback: wait for scene to become active
      NotificationCenter.default.addObserver(
        forName: UIScene.didActivateNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let self = self,
              self.window == nil,
              let windowScene = notification.object as? UIWindowScene else { return }
        NotificationCenter.default.removeObserver(self, name: UIScene.didActivateNotification, object: nil)
        let win = UIWindow(windowScene: windowScene)
        self.window = win
        factory.startReactNative(withModuleName: "main", in: win, launchOptions: launchOptions)
      }
    }
  }

  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
  }

  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    return bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return URL(string: "http://127.0.0.1:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
