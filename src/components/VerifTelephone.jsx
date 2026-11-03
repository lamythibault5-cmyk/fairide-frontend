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
 *   - l'écran « Ton numéro » du dossier livreur (DossierAppli.jsx ; `auto`).
 * Le code part par SMS (backend /auth/me/phone/request-verification), par e-mail quand ce numéro ne peut pas en recevoir.
 * Six chiffres tapés : il part tout seul (pas de bouton à chercher sous le clavier). Autour du champ :
 *   - « Renvoyer le code », après 30 s (chaque SMS est payé ; le serveur renvoie le même code tant qu'il vaut) ;
 *   - « Ce n'est pas ton numéro ? Change-le » : le bon numéro, un code y part, et le confirmer le prouve
 *     (/auth/me/request-contact-change, puis confirm-contact-change) ;
 *   - `repliEmail` (paiement seulement) : « Je n'ai pas reçu le SMS », puis le code par e-mail après un décompte visible, comme
 *     l'écran du code de l'inscription d'avant (fondateurs, 22/10/2026). Ce code-là laisse commander sans prouver le numéro
 *     (backend phone_email_fallback_at) : un SMS perdu ne bloque pas une commande. Pas pour un commerce ni un livreur, dont le
 *     numéro doit vraiment être prouvé.
 * `onFait(user, { credited })` une fois le compte à jour ; `credited` : le code promo de l'inscription, crédité à cette preuve. */

// Encore à prouver pour COMMANDER : ni numéro prouvé, ni code reçu par e-mail après un SMS perdu (backend routes/orders.js).
export function telephoneAVerifier(user) {
  return !!user && !user.simulation && !user.phoneVerified && !user.phoneEmailFallback;
}

export default function VerifTelephone({ auto = false, repliEmail = false, onFait, focusRef }) {
  const { user, token, refreshUser, requestContactChange, confirmContactChange } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  // repos → envoi → saisie (→ numero → saisie) ; « fait » une fois prouvé.
  const [etape, setEtape] = useState(auto ? 'envoi' : 'repos');
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

  async function demander({ parEmail = false } = {}) {
    setOccupe(true); setErreur('');
    try {
      const r = await api('/auth/me/phone/request-verification', { method: 'POST', token, body: parEmail ? { canal: 'email' } : {} });
      if (r.alreadyVerified) { await finir(await refreshUser()); return; }
      // Le numéro EN ENTIER : la personne est connectée, c'est le sien, et le lire en entier est ce qui fait voir une faute de frappe.
      setCanal(r.canal === 'sms' ? 'sms' : 'email'); setMasque(user?.phone || r.phoneMasked || '');
      setNumeroEnCours(''); setCode(''); setEtape('saisie');
      lancerAttenteRenvoi(DELAI_RENVOI_S);
      if (parEmail) setSmsPasRecu(false);
    } catch (e) {
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
    demander();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, user]);
  useEffect(() => { if (etape === 'saisie') champ.current?.focus({ preventScroll: true }); }, [etape]);
  // Le bouton « Commander » de la feuille ramène ici quand le code manque.
  if (focusRef) focusRef.current = () => { champ.current?.focus(); champ.current?.scrollIntoView?.({ block: 'center' }); };

  async function finir(maj, credited) {
    setEtape('fait'); setCode('');
    suivre('telephone_prouve', { support: 'commun' });
    if (credited) toast(t('verifTel.credite', { montant: euros(credited) }), 'succes');
    onFait?.(maj, { credited });
  }

  async function confirmer(valeur) {
    if (occupe || valeur.length !== 6) return;
    setOccupe(true); setErreur('');
    try {
      if (numeroEnCours) {
        const maj = await confirmContactChange('phone', numeroEnCours, valeur);
        // Un numéro qui ne reçoit pas de SMS est changé, pas prouvé : son code de vérification part alors par e-mail.
        if (!maj.phoneVerified) { setNumeroEnCours(''); await demander(); return; }
        await finir(maj);
      } else {
        const r = await api('/auth/me/phone/verify', { method: 'POST', token, body: { code: valeur } });
        const maj = await refreshUser();
        await finir(maj || r.user, r.credited);
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
