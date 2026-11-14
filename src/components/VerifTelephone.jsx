import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Icone from './Icone';
import PhoneInput from './PhoneInput';
import useDecompte, { DELAI_RENVOI_S, DELAI_CODE_EMAIL_S } from '../hooks/useDecompte';
import { euros } from '../prixPlat';
import { suivre } from '../analytics';
import { telephoneLisible } from '../validation';

/* LE NUMÉRO SE PROUVE ICI, UNE SEULE FOIS (fondateur, 2026-11-02, maquettes/inscription-legere).
 *
 * Le compte s'ouvre sans code (backend POST /auth/register) ; le numéro se prouve là où il sert, avec ce seul composant :
 *   - la feuille « Avant de commander » du paiement, à la première commande d'un client (Checkout.jsx ; `auto`, `repliEmail`) ;
 *   - Mon compte, sous le numéro (Account.jsx) — c'est là que mène l'étape « Vérifie ton mobile » d'un commerce ;
 *   - l'écran « Ton numéro » du dossier livreur (DossierAppli.jsx ; `auto`) ;
 *   - le mur devant l'espace commerce et livreur (MurTelephone.jsx ; `auto`, `repliEmail`) : commerces et livreurs le prouvent
 *     dès l'inscription (fondateur, 2026-11-05), seul le client attend sa première commande.
 * Le code part par SMS (backend /auth/me/phone/request-verification), par e-mail quand ce numéro ne peut pas en recevoir.
 * Six chiffres tapés : il part tout seul (pas de bouton à chercher sous le clavier). Autour du champ :
 *   - « Renvoyer le code », après 30 s (chaque SMS est payé ; le serveur renvoie le même code tant qu'il vaut) ;
 *   - « Ce n'est pas ton numéro ? Change-le » : le bon numéro, un code y part, et le confirmer le prouve
 *     (/auth/me/request-contact-change, puis confirm-contact-change) ;
 *   - `repliEmail` (paiement et mur du numéro) : « Je n'ai pas reçu le SMS », puis le code par e-mail après un décompte
 *     visible, comme l'écran du code de l'inscription d'avant (fondateurs, 22/10/2026). Ce code-là laisse commander, ou entrer
 *     dans l'espace commerce ou livreur, sans prouver le numéro (backend phone_email_fallback_at) : un SMS perdu ne bloque ni
 *     une commande ni une inscription. Pas dans Mon compte ni dans le dossier livreur : là, le numéro doit vraiment être
 *     prouvé (l'étape « Vérifie ton mobile » du commerce, l'envoi du dossier).
 * `onFait(user, { credited, parSms })` une fois le compte à jour ; `credited` : le code promo de l'inscription, crédité à cette
 * preuve ; `parSms` : le code tapé est arrivé par SMS. Seul un numéro prouvé PAR SMS touche le crédit de bienvenue (backend
 * routes/orders.js, G38) : un code reçu par e-mail (« Je n'ai pas reçu le SMS », ou un numéro qu'un SMS ne joint pas) laisse
 * commander sans lui. Le paiement annonce son total d'après cela (revue avant GO du 13/11, comptes 1 : il retirait le crédit
 * après un code reçu par e-mail, et la carte « Le total a changé » s'ouvrait). `onCanal(canal)` : 'sms' ou 'email', le
 * canal du code attendu, à chaque changement (le paiement n'annonce pas le crédit pendant qu'on attend un code par e-mail).
 * `simple` (paiement, fondateur, 2026-11-08, maquettes/bienvenue-partage, version A) : moins de texte. « Entre le code reçu
 * par SMS », le numéro avec « Changer », six cases, et « Pas reçu ? » seulement après le décompte (puis « Renvoyer le code »
 * et, au paiement, le code par e-mail). Le code se remplit tout seul quand le SMS arrive (one-time-code). */

// Encore à prouver pour COMMANDER : ni numéro prouvé, ni code reçu par e-mail après un SMS perdu (backend routes/orders.js).
export function telephoneAVerifier(user) {
  return !!user && !user.simulation && !user.phoneVerified && !user.phoneEmailFallback;
}

/* UN CODE DÉJÀ PARTI N'EST PAS RENVOYÉ À CHAQUE AFFICHAGE (2026-11-05). `auto` envoie le code au montage ; or le composant se
 * remonte : le mur du numéro à chaque page livreur du site (une ProtectedRoute par page), la feuille « Avant de commander »
 * refermée puis rouverte. Chaque montage repartait au serveur, qui renvoyait le même code par un nouveau SMS (payé), et le
 * sixième en une heure tombait sur « Trop de demandes » (vu en essai : quatre pages livreur, quatre SMS). Le dernier envoi est
 * donc gardé ici, le temps de la page : remonté dans les 10 minutes (le code en vaut 15), le champ revient tout de suite, avec
 * ce qui reste du décompte de « Renvoyer le code ». Un rechargement de la page renvoie, comme avant. */
const CODE_RECENT_MS = 10 * 60 * 1000;
let dernierEnvoi = null;
function envoiRecent(user) {
  return dernierEnvoi && user && dernierEnvoi.userId === user.id && Date.now() - dernierEnvoi.at < CODE_RECENT_MS ? dernierEnvoi : null;
}

export default function VerifTelephone({ auto = false, repliEmail = false, onFait, onCanal, focusRef, simple = false }) {
  const { user, token, refreshUser, requestContactChange, confirmContactChange } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [repris] = useState(() => (auto ? envoiRecent(user) : null));
  // repos → envoi → saisie (→ numero → saisie) ; « fait » une fois prouvé.
  const [etape, setEtape] = useState(repris ? (repris.attente ? 'envoi' : 'saisie') : auto ? 'envoi' : 'repos');
  const [canal, setCanal] = useState('sms');
  const [masque, setMasque] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  // Changement de numéro : le numéro tapé, puis le code envoyé À CE numéro (confirm-contact-change).
  const [nouveau, setNouveau] = useState('');
  const [numeroEnCours, setNumeroEnCours] = useState('');
  const [attenteRenvoi, lancerAttenteRenvoi] = useDecompte();
  const [smsPasRecu, setSmsPasRecu] = useState(false);
  const [attenteEmail, lancerAttenteEmail] = useDecompte();
  const champ = useRef(null);
  const lance = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onCanal?.(canal); }, [canal]);

  // Le code est parti : le champ, et le décompte de « Renvoyer le code » (`ecoule` : secondes déjà passées depuis l'envoi).
  function codeParti(r, ecoule = 0) {
    // Le numéro EN ENTIER : la personne est connectée, c'est le sien, et le lire en entier est ce qui fait voir une faute de frappe.
    setCanal(r.canal === 'sms' ? 'sms' : 'email'); setMasque(user?.phone || r.phoneMasked || '');
    setNumeroEnCours(''); setCode(''); setEtape('saisie');
    lancerAttenteRenvoi(Math.max(0, DELAI_RENVOI_S - ecoule));
  }

  async function demander({ parEmail = false } = {}) {
    setOccupe(true); setErreur('');
    let requete = null;
    try {
      requete = api('/auth/me/phone/request-verification', { method: 'POST', token, body: parEmail ? { canal: 'email' } : {} });
      // Gardé dès le départ : un remontage pendant la requête (une page qui redirige aussitôt) attend sa réponse.
      dernierEnvoi = { userId: user?.id, at: Date.now(), attente: requete };
      const r = await requete;
      if (r.alreadyVerified) { const maj = await refreshUser(); await finir(maj, undefined, maj?.phoneVerifiedVia === 'sms'); return; }
      dernierEnvoi = { userId: user?.id, at: Date.now(), canal: r.canal, phoneMasked: r.phoneMasked };
      codeParti(r);
      if (parEmail) setSmsPasRecu(false);
    } catch (e) {
      if (dernierEnvoi?.attente === requete) dernierEnvoi = null;
      // Pas encore de code : on reste où l'on était, avec la raison (plafond, numéro invalide…).
      setEtape((x) => (x === 'envoi' ? 'repos' : x));
      setErreur(e.message);
      if (e.code === 'PHONE_INVALID' || e.code === 'PHONE_MISSING') { setNouveau(user?.phone || ''); setEtape('numero'); }
    } finally { setOccupe(false); }
  }

  // Le code part dès l'ouverture quand on vient pour ça (feuille du paiement, écran du dossier) ; une fois.
  useEffect(() => {
    if (!auto || lance.current || !user) return;
    lance.current = true;
    suivre('inscription_ecran', { ecran: 'telephone-code', role: user.role, support: 'commun' });
    if (repris?.attente) {
      repris.attente.then((r) => { if (!r.alreadyVerified) codeParti(r); }).catch((e) => { setEtape('repos'); setErreur(e.message); });
      return;
    }
    if (repris) { codeParti(repris, Math.floor((Date.now() - repris.at) / 1000)); return; }
    demander();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, user]);
  useEffect(() => { if (etape === 'saisie') champ.current?.focus({ preventScroll: true }); }, [etape]);
  // Le bouton « Commander » de la feuille ramène ici quand le code manque.
  if (focusRef) focusRef.current = () => { champ.current?.focus(); champ.current?.scrollIntoView?.({ block: 'center' }); };

  // `parSms` : un numéro déjà prouvé ailleurs (alreadyVerified) le prend du compte relu, `phoneVerifiedVia` (backend
  // publicUser, revue avant GO du 14/11) : prouvé par SMS, le paiement envoie le total avec le crédit, que le serveur applique ;
  // avant, la carte « Le total a changé » s'ouvrait sur un total plus bas. Un serveur qui ne rend pas encore ce champ : faux,
  // comme avant (le paiement n'annonce pas le crédit, et si le serveur l'applique, la carte montre le total plus bas).
  async function finir(maj, credited, parSms = false) {
    dernierEnvoi = null;
    setEtape('fait'); setCode('');
    suivre('telephone_prouve', { support: 'commun' });
    if (credited) toast(t('verifTel.credite', { montant: euros(credited) }), 'succes');
    onFait?.(maj, { credited, parSms });
  }

  async function confirmer(valeur) {
    if (occupe || valeur.length !== 6) return;
    setOccupe(true); setErreur('');
    try {
      if (numeroEnCours) {
        const maj = await confirmContactChange('phone', numeroEnCours, valeur);
        // Un numéro qui ne reçoit pas de SMS est changé, pas prouvé : son code de vérification part alors par e-mail.
        if (!maj.phoneVerified) { setNumeroEnCours(''); await demander(); return; }
        await finir(maj, undefined, canal === 'sms');
      } else {
        const r = await api('/auth/me/phone/verify', { method: 'POST', token, body: { code: valeur } });
        const maj = await refreshUser();
        await finir(maj || r.user, r.credited, canal === 'sms');
      }
    } catch (e) {
      setErreur(e.message); setCode('');
      champ.current?.focus();
    } finally { setOccupe(false); }
  }

  async function envoyerNouveau() {
    if (!nouveau.trim()) { setErreur(t('auth.errFieldRequired')); return; }
    setOccupe(true); setErreur('');
    try {
      const r = await requestContactChange('phone', nouveau.trim());
      // Ce code-là va au nouveau numéro, pas à celui du compte : un remontage redemandera celui du compte.
      dernierEnvoi = null;
      setCanal(r.canal === 'sms' ? 'sms' : 'email'); setMasque(nouveau.trim());
      setNumeroEnCours(nouveau.trim()); setCode(''); setSmsPasRecu(false); setEtape('saisie');
      lancerAttenteRenvoi(DELAI_RENVOI_S);
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  }

  if (!user) return null;
  if (etape === 'fait' || (!telephoneAVerifier(user) && etape !== 'saisie' && user.phoneVerified)) {
    return <p className="vt-fait"><Icone nom="valider" taille={18} /> {t('verifTel.fait')}</p>;
  }

  if (etape === 'repos') {
    return (
      <div className="vt">
        <p className="vt-texte"><Icone nom="telephone" taille={18} className="icone-texte" /> {t('verifTel.aVerifier', { phone: telephoneLisible(user.phone) || user.phone || '' })}</p>
        {erreur && <p className="field-error" role="alert">{erreur}</p>}
        <button type="button" className="btn-outline btn-sm vt-recevoir" disabled={occupe} onClick={() => demander()}>{occupe ? t('common.loading') : t('verifTel.recevoir')}</button>
      </div>
    );
  }

  if (etape === 'numero') {
    return (
      <div className="vt">
        <p className="vt-texte">{t('verifTel.nouveauTexte')}</p>
        <div className="field vt-champ">
          <label htmlFor="vt-numero" className="sr-only">{t('auth.phone')}</label>
          <PhoneInput id="vt-numero" value={nouveau} onChange={(v) => { setNouveau(v); setErreur(''); }} invalid={!!erreur} />
          {erreur && <p className="field-error" role="alert">{erreur}</p>}
        </div>
        <button type="button" className="btn-gold vt-envoyer" disabled={occupe} onClick={envoyerNouveau}>{occupe ? t('common.loading') : t('verifTel.envoyerNouveau')}</button>
        <button type="button" className="lien-bouton vt-lien" onClick={() => { setErreur(''); setEtape(numeroEnCours || masque ? 'saisie' : 'repos'); }}>{t('common.cancel')}</button>
      </div>
    );
  }

  if (simple) {
    const numero = canal === 'sms' ? (telephoneLisible(masque) || masque || telephoneLisible(user.phone) || user.phone || '') : user.email;
    const saisir = (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); setErreur(''); if (v.length === 6) confirmer(v); };
    return (
      <div className="vt vt-simple">
        <h3 className="vt-s-titre">{t(canal === 'sms' ? 'verifTel.simpleTitreSms' : 'verifTel.simpleTitreEmail')}</h3>
        <p className="vt-s-num" aria-live="polite">
          <span>{etape === 'envoi' ? t('verifTel.envoi') : numero}</span>
          <button type="button" className="vt-s-changer" disabled={occupe} onClick={() => { setNouveau(''); setErreur(''); setEtape('numero'); }}>{t('verifTel.changerCourt')}</button>
        </p>
        <label className="vt-cases" htmlFor="vt-code">
          <span className="sr-only">{t('verifTel.codeLabel')}</span>
          <input id="vt-code" ref={champ} className="vt-cases-champ" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*"
            maxLength={6} value={code} disabled={etape === 'envoi'} onChange={saisir} />
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} aria-hidden="true" className={`vt-case${erreur ? ' vt-case--erreur' : ''}${i === code.length && etape === 'saisie' ? ' vt-case--ici' : ''}`}>{code[i] || ''}</span>
          ))}
        </label>
        {erreur && <p className="field-error vt-s-erreur" role="alert">{erreur}</p>}
        {occupe && etape === 'saisie' && <p className="vt-s-renvoi">{t('common.loading')}</p>}
        {!occupe && (attenteRenvoi > 0 || etape === 'envoi' ? (
          etape === 'saisie' && <p className="vt-s-renvoi">{t('verifTel.pasRecuDans', { s: attenteRenvoi })}</p>
        ) : (
          <div className="vt-s-liens">
            <button type="button" className="lien-bouton vt-lien" onClick={() => (numeroEnCours ? envoyerNouveau() : demander())}>{t('verifTel.pasRecuRenvoyer')}</button>
            {repliEmail && canal === 'sms' && !numeroEnCours && (
              <button type="button" className="lien-bouton vt-lien" onClick={() => demander({ parEmail: true })}>{t('verifTel.parEmail')}</button>
            )}
          </div>
        ))}
      </div>
    );
  }

  const envoye = etape === 'envoi' ? t('verifTel.envoi')
    : canal === 'sms' ? t('verifTel.envoyeSms', { phone: telephoneLisible(masque) || masque }) : t('verifTel.envoyeEmail', { email: user.email });
  return (
    <div className="vt">
      <p className="vt-texte" aria-live="polite">{envoye}</p>
      <div className="field vt-champ">
        <label htmlFor="vt-code" className="sr-only">{t('verifTel.codeLabel')}</label>
        <input id="vt-code" ref={champ} className={`vt-code${erreur ? ' input-invalid' : ''}`} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*"
          maxLength={6} placeholder="123456" value={code} disabled={etape === 'envoi'}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); setErreur(''); if (v.length === 6) confirmer(v); }} />
        {erreur && <p className="field-error" role="alert">{erreur}</p>}
      </div>
      {occupe && etape === 'saisie' && <p className="vt-texte vt-petit">{t('common.loading')}</p>}
      <div className="vt-liens">
        <button type="button" className="lien-bouton vt-lien" disabled={occupe || attenteRenvoi > 0 || etape === 'envoi'}
          onClick={() => (numeroEnCours ? envoyerNouveau() : demander())}>
          {attenteRenvoi > 0 ? t('verifTel.renvoyerDans', { s: attenteRenvoi }) : t('verifTel.renvoyer')}
        </button>
        <button type="button" className="lien-bouton vt-lien" disabled={occupe} onClick={() => { setNouveau(''); setErreur(''); setEtape('numero'); }}>{t('verifTel.changer')}</button>
      </div>
      {/* Paiement seulement : le SMS peut se perdre après le fournisseur, sans erreur pour nous (22/10/2026). En deux temps
          (fondateurs) : « Je n'ai pas reçu le SMS », puis le code par e-mail après un décompte visible. */}
      {repliEmail && canal === 'sms' && etape === 'saisie' && !numeroEnCours && (!smsPasRecu ? (
        <button type="button" className="lien-bouton vt-lien" disabled={occupe} onClick={() => { setSmsPasRecu(true); lancerAttenteEmail(DELAI_CODE_EMAIL_S); }}>{t('verifTel.pasRecu')}</button>
      ) : (
        <div className="vt-repli">
          <p className="vt-texte vt-petit">{t('verifTel.pasRecuAide')}</p>
          <button type="button" className="lien-bouton vt-lien" disabled={occupe || attenteEmail > 0} onClick={() => demander({ parEmail: true })}>
            {attenteEmail > 0 ? t('verifTel.parEmailDans', { s: attenteEmail }) : t('verifTel.parEmail')}
          </button>
        </div>
      ))}
    </div>
  );
}
