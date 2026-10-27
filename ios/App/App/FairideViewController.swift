import Capacitor
import UIKit

/* The app's web view controller (Main.storyboard points here instead of Capacitor's own CAPBridgeViewController). It only
 * adds what Capacitor cannot find by itself: plugins that live in this project rather than in node_modules, which
 * `npx cap sync` does not list in capacitor.config.json. */
class FairideViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HaptiquePlugin())
        bridge?.registerPluginInstance(RetourNatifPlugin())
        // iOS's own back swipe from the left edge (2026-10-23, version A of maquettes/transitions-appli): WebKit shows the
        // previous screen under the finger, with Apple's parallax and shadow. It walks the web history (pushState), so it
        // works with the app's router. Kept when the JavaScript swipe-back was removed (PR #217): this one shows the real
        // previous screen and does nothing where there is none (founder, 2026-10-23: « I really like the swipe »).
        // Switched off while a sheet or a window is open (RetourNatifPlugin below).
        webView?.allowsBackForwardNavigationGestures = true
        // Capacitor turns the rubber band off (CAPBridgeViewController.prepareWebView, called before this). Back on: the page
        // decides with CSS where it may bounce — at the bottom only, never against the iris band or pull-to-refresh at the
        // top (overscroll-behavior, html.pres-du-bas, src/transitionPhoto.js).
        webView?.scrollView.bounces = true
    }
}

/* WEBKIT'S BACK SWIPE, OFF WHILE A SHEET IS OPEN (2026-10-27, founder: « the things in Mon compte don't have the back
 * swipe »). A sheet (Mes infos, Favoris, a dish…) is drawn by the page over the screen it was opened from; WebKit's swipe
 * knows nothing of it and would walk the history UNDER the sheet. While one is open, src/natif.js (suspendreRetourIos,
 * called by useDialogue) switches WebKit's swipe off, and the sheet answers the same edge swipe itself
 * (useFeuilleGlissable.js: it follows the finger to the right and uncovers the screen behind). Kept in this file so the
 * Xcode project needs no new entry. Without this plugin (an older build) the call fails quietly and nothing changes. */
@objc(RetourNatifPlugin)
public class RetourNatifPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RetourNatifPlugin"
    public let jsName = "RetourNatif"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "activer", returnType: CAPPluginReturnPromise)
    ]

    @objc func activer(_ call: CAPPluginCall) {
        let actif = call.getBool("actif") ?? true
        DispatchQueue.main.async {
            self.bridge?.webView?.allowsBackForwardNavigationGestures = actif
            call.resolve()
        }
    }
}
