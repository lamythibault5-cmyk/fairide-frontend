import Capacitor
import UIKit

/* The app's web view controller (Main.storyboard points here instead of Capacitor's own CAPBridgeViewController). It only
 * adds what Capacitor cannot find by itself: plugins that live in this project rather than in node_modules, which
 * `npx cap sync` does not list in capacitor.config.json. */
class FairideViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HaptiquePlugin())
    }
}
