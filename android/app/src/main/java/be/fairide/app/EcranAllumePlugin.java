package be.fairide.app;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/* L'ÉCRAN RESTE ALLUMÉ SUR LES COMMANDES (bug hunt avant GO, G43 ; décision d'Owen, 2026-11-06). navigator.wakeLock
 * manque souvent dans la vue web Android : le téléphone du comptoir se verrouillait, la sonnerie de la page se taisait et
 * il ne restait que la notification. Ce greffon pose le drapeau de la fenêtre (FLAG_KEEP_SCREEN_ON) tant que la page
 * Commandes le demande (src/natif.js, garderEcranAllume), et le retire quand elle se ferme. Sa présence dit aussi au code
 * de la page que cette version de l'app a le canal « commandes2 » et son son long (res/raw/nouvelle_commande.wav,
 * src/pushNatif.js). Inscrit dans MainActivity. */
@CapacitorPlugin(name = "EcranAllume")
public class EcranAllumePlugin extends Plugin {

    @PluginMethod
    public void activer(PluginCall call) {
        final boolean actif = Boolean.TRUE.equals(call.getBoolean("actif", true));
        getActivity().runOnUiThread(() -> {
            if (actif) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }
}
