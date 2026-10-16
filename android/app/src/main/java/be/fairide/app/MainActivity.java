package be.fairide.app;

import android.content.Intent;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/* CONNEXION GOOGLE (greffon @capgo/capacitor-social-login). Après le choix du compte, Google peut ouvrir un écran
 * d’autorisation (souvent à la première connexion) ; sa réponse revient ICI, dans onActivityResult, et le greffon ne la
 * reçoit que si on la lui passe. Sans ce relais, la connexion attendait sans fin : bouton grisé, aucun message
 * (16 oct. 2026). L’interface ModifiedMainActivityForSocialLoginPlugin dit au greffon que le relais est en place. */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) return;
        PluginHandle poignee = getBridge().getPlugin("SocialLogin");
        if (poignee == null) return;
        Plugin greffon = poignee.getInstance();
        if (greffon instanceof SocialLoginPlugin) ((SocialLoginPlugin) greffon).handleGoogleLoginIntent(requestCode, data);
    }

    // Exigée par l’interface, jamais appelée.
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
