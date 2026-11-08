import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { estNatif, experienceApp, lienPublic } from '../natif';
import { paiementEnLigneOuvert, useLancement } from '../launch';
import { getConsent, onConsentChange } from '../consent';
import { euros, eurosCourt } from '../prixPlat';
import Modale from './Modale';
import Icone from './Icone';
import '../code-ami.css';

/* LE CRÉDIT DE BIENVENUE ET LE CODE AMI (fondateur, 2026-11-08, maquettes/bienvenue-partage ; avant : le code ami du 03/11,
 * maquettes/parrainage-visible).
 *
 * BIENVENUE : tout client reçoit « 5 € de crédit offerts » sur sa première commande payée en ligne de 20 € de plats ou plus,
 * une fois par compte et par numéro prouvé par SMS, utilisés tout seuls au paiement (backend routes/orders.js, ligne réservée
 * CODE_AMI). Jamais « −5 € » : un cadeau, pas une réduction. La feuille « On t'offre 5 € de crédit » se montre une fois, après
 * le badge, tant que le serveur dit le crédit encore à prendre (GET /auth/me › bienvenue).
 *
 * CODE AMI : chaque client a un code (users.own_referral_code). Celui qui le partage reçoit 3 € sur son solde quand la
 * première commande payée en ligne de son ami lui est remise (referrals.js) ; l'ami n'a rien de plus que la bienvenue de tout
 * le monde. Montré dans Compte › Portefeuille (carte courte) et une fois sur « Commande confirmée ».
 *
 * AVANT LE GO, RIEN NE PROMET LE CRÉDIT. Il ne sert que sur une commande payée en ligne, qui n'existe qu'après le GO
 * (lancement.md) : la feuille et le rappel attendent le GO. Les comptes exemptés (test, équipe) voient déjà tout. */

// Le nom de la ligne réservée (backend migrations 107 et 123, referrals.CODE_AMI) : le panier et le reçu la traduisent en
// « Crédit de bienvenue ».
export const CODE_AMI = 'CODE-AMI';
const CLE_BIENVENUE = 'fairide_bienvenue_credit_vu';
const CLE_RAPPEL = 'fairide_code_ami_rappel';
const CLE_BADGE = 'fairide_badge_explique';
const PAGES_FEUILLE = ['/', '/home', '/restaurants'];
// Ce que reçoit celui qui partage, par ami (backend referrals.CLIENT_REFERRAL_REWARD) ; le serveur le redit (referral/mine › parAmi).
export const PAR_AMI = 3;
// Le crédit de bienvenue (backend referrals.REFERRAL_FRIEND_REWARD) : pour qui n'a pas encore de compte (l'invitation à un
// groupe) ; connecté, le serveur le dit lui-même (GET /auth/me › bienvenue).
export const MONTANT_BIENVENUE = 5;
// « 5 € », « 3 € » : un montant rond, dans le format de la langue (« € 5 » en néerlandais).
export const eurosRond = (n) => eurosCourt(n);

function lire(cle) {
  try { return localStorage.getItem(cle) === 'vu'; } catch { return true; }
}
function noter(cle) {
  try { localStorage.setItem(cle, 'vu'); } catch { /* stockage indisponible : elle reviendra, sans gravité */ }
}

function useCodeAmi() {
  const { user, role } = useAuth();
  useLancement(); // redessine au GO
  const code = role === 'client' && !user?.isAdmin ? (user?.ownReferralCode || '') : '';
  return { code, ouvert: paiementEnLigneOuvert(user), user };
}

/* Partage natif (feuille du téléphone : Messages, WhatsApp…), le message ET le lien : le lien ouvre l'inscription avec le code
 * déjà rempli (site : Auth.jsx ; app installée : ConnexionAppli.jsx, ?ref=). Dans l'app, le greffon Share de Capacitor : la
 * vue web d'Android n'a pas navigator.share. Sans partage du tout (ordinateur), le message et le lien sont copiés. Renvoie
 * true quand le partage est parti (ou copié) ; un partage annulé n'est pas une erreur. */
async function partager({ code, ouvert, t, toast }) {
  const url = lienPublic(`/login?ref=${encodeURIComponent(code)}`);
  const text = t(ouvert ? 'codeAmi.messageBienvenue' : 'codeAmi.messageSeul', { code });
  try {
    if (estNatif()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'Fairride', text, url, dialogTitle: t('codeAmi.partager') });
      return true;
    }
    if (navigator.share) { await navigator.share({ title: 'Fairride', text, url }); return true; }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast(t('codeAmi.messageCopie'), 'succes');
    return true;
  } catch (e) {
    if (e?.name === 'AbortError' || /cancel/i.test(String(e?.message || ''))) return false;
    toast(t('codeAmi.partageImpossible', { code }));
    return false;
  }
}

function usePartager() {
  const { code, ouvert } = useCodeAmi();
  const { t } = useLanguage();
  const toast = useToast();
  return () => partager({ code, ouvert, t, toast });
}

/* LA FEUILLE DE BIENVENUE. Une fois par téléphone (ou navigateur), sur la liste, pour un client dont le crédit est encore à
 * prendre : le nouveau compte comme celui qui n'a jamais commandé. Dans l'app, juste après l'écran du badge (EcranBadge.jsx
 * prévient en se fermant) ; sur le site, une fois la carte des cookies répondue. « Choisir mon repas », « Plus tard », le
 * fond ou Échap la ferment pour de bon : le crédit, lui, reste et s'applique tout seul au paiement. */
export default function FeuilleBienvenue() {
  const { user, ouvert } = useCodeAmi();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const [vue, setVue] = useState(() => lire(CLE_BIENVENUE));
  const [badgeVu, setBadgeVu] = useState(() => !experienceApp() || lire(CLE_BADGE));
  const [cookiesRepondus, setCookiesRepondus] = useState(() => experienceApp() || !!getConsent());
  useEffect(() => {
    const surBadge = () => setBadgeVu(true);
    window.addEventListener('fairide:badge-vu', surBadge);
    const finCookies = onConsentChange((v) => setCookiesRepondus(!!v));
    return () => { window.removeEventListener('fairide:badge-vu', surBadge); finCookies?.(); };
  }, []);

  const bienvenue = user?.role === 'client' && !user?.isAdmin ? user?.bienvenue : null;
  if (vue || !bienvenue || !ouvert || !badgeVu || !cookiesRepondus || !PAGES_FEUILLE.includes(pathname)) return null;
  const fermer = () => { noter(CLE_BIENVENUE); setVue(true); };
  const montant = eurosRond(bienvenue.montant);
  return (
    <Modale ariaLabel={t('codeAmi.bienvenueTitre', { montant })} onFermer={fermer} classeBoite="code-ami-feuille">
      <div className="code-ami-ticket">
        <span className="code-ami-ticket-haut"><Icone nom="cadeau" taille={18} />{t('codeAmi.bienvenueTicket')}</span>
        <b className="code-ami-code bienvenue-montant">{t('codeAmi.bienvenueMontant', { montant })}</b>
        <span className="code-ami-ticket-bas"><Icone nom="valider" taille={15} />{t('codeAmi.bienvenueBas')}</span>
      </div>
      <h2 className="code-ami-titre">{t('codeAmi.bienvenueTitre', { montant })}</h2>
      <p className="code-ami-sous">{t('codeAmi.bienvenueSous', { minimum: eurosRond(bienvenue.minimum) })}</p>
      <button type="button" className="btn-gold code-ami-bouton" onClick={fermer}>{t('codeAmi.bienvenueBouton')}</button>
      <button type="button" className="code-ami-lien" onClick={fermer}>{t('codeAmi.plusTard')}</button>
    </Modale>
  );
}

/* LA CARTE DE COMPTE › PORTEFEUILLE, COURTE (maquettes/bienvenue-partage, C) : le montant en grand, le code et « Partager »
 * sur une ligne (le lime de la page reste « Ajouter un code »), les conditions derrière un lien. Ce que les amis ont rapporté
 * n'apparaît qu'à partir du premier ami. `stats` : GET /auth/referral/mine. */
export function CarteCodeAmi({ stats }) {
  const { code: codeCompte } = useCodeAmi();
  const { t } = useLanguage();
  const lancerPartage = usePartager();
  const [copie, setCopie] = useState(false);
  const [conditions, setConditions] = useState(false);
  const code = stats?.code || codeCompte;
  if (!code) return null;
  const copier = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopie(true); setTimeout(() => setCopie(false), 1800); }).catch(() => {});
  };
  const montant = eurosRond(stats?.parAmi || PAR_AMI);
  const n = stats?.rewardedCount || 0;
  const attente = stats?.pendingCount || 0;
  return (
    <div className="code-ami-carte">
      <div className="code-ami-tete">
        <span className="code-ami-rond" aria-hidden="true"><Icone nom="cadeau" taille={22} /></span>
        <b className="code-ami-accroche">{t('codeAmi.carteTitre')}<em>{t('codeAmi.cartePour', { montant })}</em></b>
      </div>
      <div className="code-ami-rang">
        <button type="button" className="code-ami-puce" onClick={copier} aria-live="polite" aria-label={`${t('codeAmi.ticket')} ${code} · ${t('codeAmi.copier')}`}>
          <b>{code}</b><span>{copie ? t('codeAmi.copie') : t('codeAmi.copier')}</span>
        </button>
        <button type="button" className="code-ami-partager" onClick={lancerPartage}>{t('codeAmi.partagerCourt')}</button>
      </div>
      {(n > 0 || attente > 0) && (
        <p className="small code-ami-stats">
          {n > 0 && t(n === 1 ? 'codeAmi.gagnesUn' : 'codeAmi.gagnesPlusieurs', { n, montant: euros(stats?.earnedTotal || 0) })}
          {n > 0 && attente > 0 && ' · '}
          {attente > 0 && t(attente === 1 ? 'codeAmi.attenteUn' : 'codeAmi.attentePlusieurs', { n: attente })}
        </p>
      )}
      <div className="code-ami-pied">
        <span>{t('codeAmi.carteQuand')}</span>
        <button type="button" className="code-ami-lien-conditions" aria-expanded={conditions} onClick={() => setConditions((c) => !c)}>{t('codeAmi.conditionsLien')}</button>
      </div>
      {conditions && <p className="small code-ami-conditions">{t('codeAmi.conditions', { montant })}</p>}
    </div>
  );
}

/* LE RAPPEL SUR L'ÉCRAN « COMMANDE CONFIRMÉE », une fois par téléphone (le moment où l'on est content). Une rangée calme
 * sous le récapitulatif, sans lime (le lime de l'écran est « Suivre ma commande »). Compté comme vu dès qu'il s'affiche. */
export function RappelCodeAmi() {
  const { code, ouvert } = useCodeAmi();
  const { t } = useLanguage();
  const lancerPartage = usePartager();
  const [montre] = useState(() => !lire(CLE_RAPPEL));
  const visible = montre && !!code && ouvert;
  useEffect(() => { if (visible) noter(CLE_RAPPEL); }, [visible]);
  if (!visible) return null;
  return (
    <div className="code-ami-rappel">
      <span className="code-ami-rappel-icone" aria-hidden="true"><Icone nom="cadeau" taille={20} /></span>
      <span className="code-ami-rappel-texte"><b>{t('codeAmi.rappelTitre', { montant: eurosRond(PAR_AMI) })}</b><small>{t('codeAmi.ticket')} : {code}</small></span>
      <button type="button" className="code-ami-rappel-bouton" onClick={lancerPartage}>{t('codeAmi.partagerCourt')}</button>
    </div>
  );
}
