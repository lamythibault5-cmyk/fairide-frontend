import Capacitor
import UIKit

/* The app's web view controller (Main.storyboard points here instead of Capacitor's own CAPBridgeViewController). It only
 * adds what Capacitor cannot find by itself: plugins that live in this project rather than in node_modules, which
 * `npx cap sync` does not list in capacitor.config.json. */
class FairideViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HaptiquePlugin())
        // iOS's own back swipe from the left edge (2026-10-23, version A of maquettes/transitions-appli): WebKit shows the
        // previous screen under the finger, with Apple's parallax and shadow. It walks the web history (pushState), so it
        // works with the app's router. Kept when the JavaScript swipe-back was removed (PR #217): this one shows the real
        // previous screen and does nothing where there is none (founder, 2026-10-23: « I really like the swipe »).
        webView?.allowsBackForwardNavigationGestures = true
        // Capacitor turns the rubber band off (CAPBridgeViewController.prepareWebView, called before this). Back on: the page
        // decides with CSS where it may bounce — at the bottom only, never against the iris band or pull-to-refresh at the
        // top (overscroll-behavior, html.pres-du-bas, src/transitionPhoto.js).
        webView?.scrollView.bounces = true
    }
}
