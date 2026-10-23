import Capacitor
import UIKit

/* HAPTICS THAT YOU FEEL, AT THE MOMENT OF THE TOUCH (2026-10-23, TestFlight: « I can't feel the haptics »).
 *
 * @capacitor/haptics creates a new generator on every call and fires it at once: the Taptic Engine is idle, so the tap
 * comes late and soft, and it only offers light / medium / heavy (light, used for most taps, is lost in a case). This
 * plugin keeps ONE generator of each kind for the life of the app, warms them up when a finger touches the screen
 * (`preparer`, called from src/natif.js on pointerdown) and fires the one that matches the MEANING of the gesture
 * (`jouer`, src/gestes.js lists the meanings). Every call answers at once: JavaScript never waits for a haptic.
 * The user's « System Haptics » switch (Settings › Sounds & Haptics) is applied by iOS itself.
 * Registered by FairideViewController; without this plugin (an older build) natif.js falls back to @capacitor/haptics. */
@objc(HaptiquePlugin)
public class HaptiquePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HaptiquePlugin"
    public let jsName = "Haptique"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "jouer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preparer", returnType: CAPPluginReturnPromise)
    ]

    // Created on first use, on the main thread (every call below hops to it): UIKit generators are main-thread only.
    private lazy var choix = UISelectionFeedbackGenerator()
    private lazy var rigide = UIImpactFeedbackGenerator(style: .rigid)
    private lazy var moyen = UIImpactFeedbackGenerator(style: .medium)
    private lazy var doux = UIImpactFeedbackGenerator(style: .soft)
    private lazy var lourd = UIImpactFeedbackGenerator(style: .heavy)
    private lazy var resultat = UINotificationFeedbackGenerator()

    // A finger is down: the next haptic, if any, plays without the engine's wake-up delay. Apple: the prepared state lasts
    // a few seconds and costs a little power, so it is only asked for while someone is touching the screen.
    @objc func preparer(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.choix.prepare()
            self.rigide.prepare()
            self.moyen.prepare()
            self.resultat.prepare()
        }
        call.resolve()
    }

    @objc func jouer(_ call: CAPPluginCall) {
        let sens = call.getString("sens") ?? "valider"
        DispatchQueue.main.async {
            switch sens {
            case "choix":                                   // moving over options: tab lens, chips, sections, segments
                self.choix.selectionChanged()
                self.choix.prepare()
            case "bascule":                                 // a small control: heart, switch, − / +
                self.rigide.impactOccurred(intensity: 0.7)
            case "seuil":                                   // a threshold crossed or a lens landing
                self.rigide.impactOccurred(intensity: 1.0)
            case "pose":                                    // a sheet settling
                self.doux.impactOccurred(intensity: 0.8)
            case "appuiLong":
                self.lourd.impactOccurred()
            case "succes":
                self.resultat.notificationOccurred(.success)
            case "attention":
                self.resultat.notificationOccurred(.warning)
            case "erreur":
                self.resultat.notificationOccurred(.error)
            default:                                        // "valider": a committing tap (Add, Pay, Accept, Claim, Send)
                self.moyen.impactOccurred(intensity: 0.9)
            }
        }
        call.resolve()
    }
}
