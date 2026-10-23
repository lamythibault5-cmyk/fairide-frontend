package be.fairide.app;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import android.view.View;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/* LES VIBRATIONS DU TÉLÉPHONE LUI-MÊME (2026-10-23, test de l'app : « je ne sens pas les vibrations »). @capacitor/haptics
 * joue sur Android des ondes du vibreur : un bourdonnement, le même pour tout. Ce greffon demande à la vue web le retour
 * tactile du système (performHapticFeedback), celui du clavier et des réglages : des clics nets, qui suivent le réglage
 * « Retour tactile » de la personne. Chaque SENS (src/gestes.js) a son effet, avec un repli pour les Android plus anciens.
 * Inscrit dans MainActivity ; sans lui (ancienne version de l'app), natif.js retombe sur @capacitor/haptics. */
@CapacitorPlugin(name = "Haptique")
public class HaptiquePlugin extends Plugin {

    @PluginMethod
    public void jouer(PluginCall call) {
        final String sens = call.getString("sens", "valider");
        call.resolve();
        getActivity().runOnUiThread(() -> {
            View vue = getBridge().getWebView();
            if (vue == null) return;
            int effet = effet(sens);
            // Un effet que ce téléphone ne connaît pas rend false : le clic simple de la touche virtuelle prend le relais.
            if (!vue.performHapticFeedback(effet)) vue.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
        });
    }

    // Rien à préparer sur Android : l'effet part sans délai. La méthode existe pour que natif.js appelle la même chose partout.
    @PluginMethod
    public void preparer(PluginCall call) {
        call.resolve();
    }

    private static int effet(String sens) {
        int api = Build.VERSION.SDK_INT;
        switch (sens) {
            case "choix": // le cran d'une molette : lentilles, puces, sections
                return api >= 34 ? HapticFeedbackConstants.SEGMENT_TICK : HapticFeedbackConstants.CLOCK_TICK;
            case "bascule": // un petit contrôle : cœur, interrupteur, − / +
                return api >= 34 ? HapticFeedbackConstants.TOGGLE_ON : HapticFeedbackConstants.KEYBOARD_TAP;
            case "seuil": // un seuil franchi, une lentille qui se pose
                return api >= 34 ? HapticFeedbackConstants.GESTURE_THRESHOLD_ACTIVATE : HapticFeedbackConstants.CONTEXT_CLICK;
            case "pose": // une feuille qui se pose
                return api >= 30 ? HapticFeedbackConstants.GESTURE_END : HapticFeedbackConstants.CLOCK_TICK;
            case "appuiLong":
                return HapticFeedbackConstants.LONG_PRESS;
            case "succes":
                return api >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY;
            case "attention":
            case "erreur":
                return api >= 30 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS;
            default: // « valider » : un toucher qui engage (Ajouter, Payer, Accepter, Prendre la course, Envoyer)
                return HapticFeedbackConstants.VIRTUAL_KEY;
        }
    }
}
