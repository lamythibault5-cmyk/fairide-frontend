import UIKit
import UserNotifications
import Capacitor
import FirebaseCore
import FirebaseMessaging
import GoogleSignIn

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase only when GoogleService-Info.plist was copied into the build (it stays out of git, like
        // android/app/google-services.json): FirebaseApp.configure() without it stops the app at launch.
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
        return true
    }

    // Every push sets the icon's red badge to 1 (fairide-backend/fcm.js, aps.badge) and iOS keeps it until the app
    // resets it: nothing did, so the « 1 » stayed on the home screen after opening the app (Owen, 2026-10-26, on the
    // App Review account). Opening the app means the person has seen it: back to 0. Delivered notifications stay listed.
    func applicationDidBecomeActive(_ application: UIApplication) {
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(0) { _ in }
        } else {
            application.applicationIconBadgeNumber = 0
        }
    }

    // The server sends every push through Firebase (fairide-backend/fcm.js), which needs a Firebase token, not the
    // APNs token iOS hands out: hand APNs' token to Firebase and give the Firebase one to @capacitor/push-notifications
    // (src/pushNatif.js posts it to /push/native-token). An APNs token sent as is is refused by FCM (INVALID_ARGUMENT)
    // and the server deletes it as dead, so the iPhone silently never got a notification.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard FirebaseApp.app() != nil else {
            NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications,
                                            object: NSError(domain: "Fairide", code: 1, userInfo: [NSLocalizedDescriptionKey: "GoogleService-Info.plist absent"]))
            return
        }
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error = error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
            } else if let token = token {
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Return from the Google sign-in sheet (@capgo/capacitor-social-login), then the App plugin's url opens.
        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Universal links (https://fairide.be/…, public/.well-known/apple-app-site-association), Stripe returns included.
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
