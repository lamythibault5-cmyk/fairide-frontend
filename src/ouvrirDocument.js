import { api } from './api';
import urlSure from './urlSure';

/* Ouvre une pièce jointe dont l'adresse n'est pas publique.
 *
 * POURQUOI CE DÉTOUR. Les pièces des livreurs — carte d'identité, permis, titre de séjour — étaient
 * livrées par Cloudinary sur une adresse publique et PERMANENTE. Elle n'était pas devinable, mais ce
 * n'est pas un contrôle d'accès : une adresse qui fuit une fois (historique d'un poste partagé,
 * en-tête Referer, capture d'écran transférée) reste valable pour toujours, et rien ne permet de la
 * révoquer. Le serveur ne rend donc plus cette adresse ; il en produit une signée, valable quelques
 * minutes, après avoir vérifié que l'appelant a le droit de voir ce document précis.
 *
 * POURQUOI ON OUVRE L'ONGLET AVANT L'APPEL. Un navigateur ne laisse ouvrir un onglet que pendant le
 * geste de l'utilisateur. Attendre la réponse de l'API puis appeler window.open ferait bloquer
 * l'ouverture comme une fenêtre surgissante — sur Safari systématiquement. On ouvre donc l'onglet
 * tout de suite, vide, et on l'emmène à destination quand l'adresse arrive.
 *
 * `noopener` reste indispensable : sans lui, la page ouverte peut réécrire l'onglet d'origine
 * (window.opener) et y afficher une fausse page de connexion. */
export default async function ouvrirDocument({ url, lien, token, toast, messageErreur }) {
  // Pièce d'avant la migration : encore publique, le serveur rend son adresse directement.
  if (url) {
    const sure = urlSure(url);
    if (sure) window.open(sure, '_blank', 'noopener,noreferrer');
    return;
  }
  const onglet = window.open('', '_blank', 'noopener,noreferrer');
  try {
    const r = await api(lien, { token });
    const sure = urlSure(r?.url);
    if (!sure) throw new Error(messageErreur || 'Document indisponible.');
    if (onglet) onglet.location = sure;
    else window.open(sure, '_blank', 'noopener,noreferrer'); // onglet bloqué : dernier recours
  } catch (e) {
    // L'onglet vide resterait sinon ouvert sur une page blanche, sans explication.
    if (onglet) onglet.close();
    toast?.(e.message || messageErreur || 'Document indisponible.');
  }
}
