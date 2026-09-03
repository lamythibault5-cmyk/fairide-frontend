// Impression sur imprimante thermique Bluetooth depuis le navigateur, via l'API Web Bluetooth.
//
// CE QUI MARCHE ET CE QUI NE MARCHE PAS — à lire avant de toucher à ce fichier.
//
// 1. Web Bluetooth n'existe que sur Chrome, Edge et Opera (Android, Windows, macOS, Linux, ChromeOS).
//    Safari ne l'implémente pas, Firefox non plus. Sur iPhone et iPad, TOUS les navigateurs sont
//    obligés d'utiliser le moteur de Safari : Chrome sur iOS n'y change donc rien. Un restaurateur
//    sur iPad ne peut pas imprimer par ce chemin, quoi qu'il fasse — d'où le repli obligatoire sur
//    l'impression navigateur (window.print), qui reste proposée à tout le monde et couvre AirPrint.
//
// 2. L'API ne parle QUE le Bluetooth Low Energy (BLE/GATT). Beaucoup d'imprimantes thermiques bon
//    marché sont en Bluetooth Classique (profil série SPP) : elles sont invisibles pour n'importe quel
//    navigateur, sans contournement possible côté web. Le modèle doit être BLE.
//
// 3. L'appairage passe obligatoirement par le sélecteur du navigateur, ouvert par un geste de
//    l'utilisateur. On ne peut pas se reconnecter tout seul au démarrage : le navigateur ne rend
//    l'appareil de nouveau accessible qu'après un nouveau clic. La connexion est donc gardée en
//    mémoire tant que l'onglet vit, et redemandée après un rechargement.

// Services GATT connus des imprimantes thermiques BLE. Aucun standard n'existe : chaque fabricant
// choisit son identifiant, ceux-ci couvrent les puces les plus répandues. Ils doivent être déclarés à
// l'appairage, sinon le navigateur refuse d'y accéder ensuite, même si l'appareil les expose.
const SERVICES_IMPRIMANTES = [
  0x18f0,                                    // Puce répandue (Goojprt, Xprinter, Munbyn...)
  0xff00,                                    // Variante fréquente
  0xffe0,                                    // Modules série BLE type HM-10
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',    // Microchip/ISSC, utilisé par plusieurs modèles
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
];

// Taille des morceaux envoyés. Une écriture BLE ne dépasse pas la MTU négociée (souvent 20 octets sur
// les modules anciens, jusqu'à 512 sur les récents). 180 passe partout en pratique ; au-delà, les
// modèles bas de gamme perdent silencieusement la fin du ticket — le papier sort tronqué sans erreur.
const TAILLE_MORCEAU = 180;
const PAUSE_ENTRE_MORCEAUX_MS = 24;

let appareil = null;
let caracteristique = null;

export function isSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

// Distingue « ce navigateur ne peut pas » de « ce navigateur pourrait mais la page n'est pas sécurisée ».
// Web Bluetooth exige un contexte sécurisé : en production le site est en HTTPS, mais un test sur une
// IP locale en http échouerait sans que la cause soit visible.
export function unsupportedReason() {
  if (typeof navigator === 'undefined') return null;
  if (navigator.bluetooth) return null;
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return "L'impression Bluetooth exige une connexion securisee (https).";
  }
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "Sur iPhone et iPad, aucun navigateur n'autorise le Bluetooth depuis une page web. Utilise « Imprimer le bon de livraison », qui fonctionne avec AirPrint.";
  }
  return "Ce navigateur ne gere pas le Bluetooth. Chrome ou Edge le permettent ; sinon, utilise « Imprimer le bon de livraison ».";
}

export function connectedDeviceName() {
  return appareil?.gatt?.connected ? (appareil.name || 'Imprimante') : null;
}

// Cherche une caractéristique où l'on peut écrire. `writeValueWithoutResponse` est nettement plus
// rapide sur un flux d'impression, mais tous les modules ne l'exposent pas : on retombe alors sur
// l'écriture avec accusé de réception.
async function trouverCaracteristique(serveur) {
  const services = await serveur.getPrimaryServices();
  for (const service of services) {
    let caracs;
    try { caracs = await service.getCharacteristics(); } catch { continue; }
    for (const c of caracs) {
      if (c.properties.writeWithoutResponse || c.properties.write) return c;
    }
  }
  return null;
}

export async function connect() {
  if (!isSupported()) throw new Error(unsupportedReason() || 'Bluetooth indisponible.');

  // acceptAllDevices plutôt qu'un filtre sur les services : beaucoup d'imprimantes n'annoncent pas
  // leur service dans la trame de découverte, et un filtre les rendrait tout simplement absentes de
  // la liste. optionalServices reste indispensable pour obtenir l'accès une fois l'appareil choisi.
  appareil = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES_IMPRIMANTES
  });
  appareil.addEventListener('gattserverdisconnected', () => { caracteristique = null; });

  const serveur = await appareil.gatt.connect();
  caracteristique = await trouverCaracteristique(serveur);
  if (!caracteristique) {
    appareil.gatt.disconnect();
    appareil = null;
    throw new Error("Cet appareil ne semble pas etre une imprimante : aucun canal d'ecriture trouve.");
  }
  return appareil.name || 'Imprimante';
}

export function disconnect() {
  try { appareil?.gatt?.disconnect(); } catch { /* deja deconnecte */ }
  appareil = null;
  caracteristique = null;
}

export async function printBytes(bytes) {
  // La connexion peut être tombée entre deux tickets (imprimante éteinte, hors de portée) : on la
  // rétablit sans redemander l'appairage, l'appareil étant déjà autorisé.
  if (appareil && !appareil.gatt.connected) {
    const serveur = await appareil.gatt.connect();
    caracteristique = await trouverCaracteristique(serveur);
  }
  if (!caracteristique) throw new Error('Aucune imprimante connectee.');

  const sansReponse = caracteristique.properties.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += TAILLE_MORCEAU) {
    const morceau = bytes.slice(i, i + TAILLE_MORCEAU);
    if (sansReponse && caracteristique.writeValueWithoutResponse) {
      await caracteristique.writeValueWithoutResponse(morceau);
    } else {
      await caracteristique.writeValue(morceau);
    }
    // Sans cette pause, le tampon des modules bas de gamme déborde et le ticket sort amputé.
    if (i + TAILLE_MORCEAU < bytes.length) await new Promise((r) => setTimeout(r, PAUSE_ENTRE_MORCEAUX_MS));
  }
}
