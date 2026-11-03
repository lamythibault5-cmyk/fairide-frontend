import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { estNatif, experienceApp, lienPublic } from '../natif';
import { paiementEnLigneOuvert, useLancement } from '../launch';
import { getConsent, onConsentChange } from '../consent';
import { euros } from '../prixPlat';
import Modale from './Modale';
import Icone from './Icone';
import '../code-ami.css';

/* LE CODE AMI, VISIBLE (fondateur, 2026-11-03, maquettes/parrainage-visible : B, carte proposée, message avec lien, rappel
 * après la première commande, comptes déjà ouverts compris, site comme l'app).
 *
 * Chaque client a un code (users.own_referral_code). L'ami qui s'inscrit avec reçoit 5 € de réduction sur sa première commande
 * payée en ligne de 20 € de plats ou plus, appliqués tout seuls par le serveur (backend routes/orders.js, CODE_AMI) ; le client
 * reçoit 5 € sur son solde quand cette commande est remise, pour chaque ami, sans plafond (referrals.js).
 *
 * AVANT LE GO, RIEN NE PROMET LES 5 € DE L'AMI. Le solde et le code ami ne servent que sur une commande payée en ligne, qui
 * n'existe qu'après le GO (lancement.md) : la feuille et le rappel attendent le GO, et la carte de Compte garde « Invite un ami,
 * reçois 5 € » sans parler de l'ami. Les comptes exemptés (test, équipe) voient déjà tout, pour l'essayer en production. */

// Le nom de la ligne réservée (backend migration 107, referrals.CODE_AMI) : le panier et le reçu le traduisent en « Code ami ».
export const CODE_AMI = 'CODE-AMI';
const CLE_FEUILLE = 'fairide_code_ami_vu';
const CLE_RAPPEL = 'fairide_code_ami_rappel';
const CLE_BADGE = 'fairide_badge_explique';
const PAGES_FEUILLE = ['/', '/home', '/restaurants'];

function lire(cle) {
  try { return localStorage.getItem(cle) === 'vu'; } catch { return true; }
}
function noter(cle) {
  try { localStorage.setItem(cle, 'vu'); } catch { /* stockage indisponible : elle reviendra, sans gravité */ }
}

// Le code du client et la version des textes : « deux » (5 € chacun) une fois le paiement en ligne ouvert, « seul » avant.
function useCodeAmi() {
  const { user, role } = useAuth();
  useLancement(); // redessine au GO
  const code = role === 'client' && !user?.isAdmin ? (user?.ownReferralCode || '') : '';
  return { code, deux: paiementEnLigneOuvert(user), user };
}

/* Partage natif (feuille du téléphone : Messages, WhatsApp…), le message ET le lien : le lien ouvre l'inscription avec le code
 * déjà rempli (site : Auth.jsx ; app installée : ConnexionAppli.jsx, ?ref=). Dans l'app, le greffon Share de Capacitor : la
 * vue web d'Android n'a pas navigator.share. Sans partage du tout (ordinateur), le message et le lien sont copiés. Renvoie
 * true quand le partage est parti (ou copié) ; un partage annulé n'est pas une erreur. */
async function partager({ code, deux, t, toast }) {
  const url = lienPublic(`/login?ref=${encodeURIComponent(code)}`);
  const text = t(deux ? 'codeAmi.messageDeux' : 'codeAmi.messageSeul', { code });
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
  const { code, deux } = useCodeAmi();
  const { t } = useLanguage();
  const toast = useToast();
  return () => partager({ code, deux, t, toast });
}

// Le code en grand, et où il reste (la carte de Compte a sa version pâle, avec « Copier »).
export function TicketCodeAmi({ code }) {
  const { t } = useLanguage();
  return (
    <div className="code-ami-ticket">
      <span className="code-ami-ticket-haut"><Icone nom="cadeau" taille={18} />{t('codeAmi.ticket')}</span>
      <b className="code-ami-code">{code}</b>
      <span className="code-ami-ticket-bas"><Icone nom="compte" taille={15} />{t('codeAmi.ou')}</span>
    </div>
  );
}

/* LA FEUILLE APRÈS L'INSCRIPTION (version B de la maquette). Une fois par téléphone (ou navigateur), sur la liste, pour tout
 * client connecté : le nouveau compte comme celui qui existait déjà. Dans l'app, juste après l'écran du badge (EcranBadge.jsx
 * prévient en se fermant) ; sur le site, une fois la carte des cookies répondue, pour ne jamais s'ouvrir par-dessus. Elle monte
 * sur la liste (Modale : feuille qui se tire vers le bas sur téléphone, fenêtre centrée sur ordinateur). « Plus tard », le
 * fond, Échap ou un partage la ferment pour de bon : le code reste dans Compte › Portefeuille. */
export default function FeuilleCodeAmi() {
  const { code, deux } = useCodeAmi();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const lancerPartage = usePartager();
  const [vue, setVue] = useState(() => lire(CLE_FEUILLE));
  const [badgeVu, setBadgeVu] = useState(() => !experienceApp() || lire(CLE_BADGE));
  const [cookiesRepondus, setCookiesRepondus] = useState(() => experienceApp() || !!getConsent());
  useEffect(() => {
    const surBadge = () => setBadgeVu(true);
    window.addEventListener('fairide:badge-vu', surBadge);
    const finCookies = onConsentChange((v) => setCookiesRepondus(!!v));
    return () => { window.removeEventListener('fairide:badge-vu', surBadge); finCookies?.(); };
  }, []);

  if (vue || !code || !deux || !badgeVu || !cookiesRepondus || !PAGES_FEUILLE.includes(pathname)) return null;
  const fermer = () => { noter(CLE_FEUILLE); setVue(true); };
  const surPartage = async () => { if (await lancerPartage()) fermer(); };
  return (
    <Modale ariaLabel={t('codeAmi.carteDeux')} onFermer={fermer} classeBoite="code-ami-feuille">
      <TicketCodeAmi code={code} />
      <h2 className="code-ami-titre">{t('codeAmi.titreDeux')}</h2>
      <p className="code-ami-sous">{t('codeAmi.sousDeux')}</p>
      <button type="button" className="btn-gold code-ami-bouton" onClick={surPartage}>{t('codeAmi.partager')}</button>
      <button type="button" className="code-ami-lien" onClick={fermer}>{t('codeAmi.plusTard')}</button>
    </Modale>
  );
}

/* LA CARTE DE COMPTE › PORTEFEUILLE : ouverte d'office (plus de feuille à ouvrir), le code en grand avec « Copier »,
 * « Partager mon code » en iris (le lime de la page reste « Ajouter un code »), ce que les amis ont rapporté, et les
 * conditions en clair. `stats` : GET /auth/referral/mine. */
export function CarteCodeAmi({ stats }) {
  const { code: codeCompte, deux } = useCodeAmi();
  const { t } = useLanguage();
  const lancerPartage = usePartager();
  const [copie, setCopie] = useState(false);
  const code = stats?.code || codeCompte;
  if (!code) return null;
  const copier = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopie(true); setTimeout(() => setCopie(false), 1800); }).catch(() => {});
  };
  const gagnes = euros(stats?.earnedTotal || 0);
  const n = stats?.rewardedCount || 0;
  const attente = stats?.pendingCount || 0;
  return (
    <div className="code-ami-carte">
      <div className="code-ami-tete">
        <span className="account-link-icon" aria-hidden="true"><Icone nom="cadeau" taille={22} /></span>
        <span><b>{t(deux ? 'codeAmi.carteDeux' : 'codeAmi.carteSeul')}</b><span className="small">{t(deux ? 'codeAmi.sousDeux' : 'codeAmi.sousSeul')}</span></span>
      </div>
      <div className="code-ami-ticket code-ami-ticket--clair">
        <span><span className="code-ami-ticket-haut">{t('codeAmi.ticket')}</span><b className="code-ami-code">{code}</b></span>
        <button type="button" className="code-ami-copier" onClick={copier} aria-live="polite">{copie ? t('codeAmi.copie') : t('codeAmi.copier')}</button>
      </div>
      <button type="button" className="btn-teal code-ami-partager" onClick={lancerPartage}><Icone nom="lien" taille={18} />{t('codeAmi.partager')}</button>
      <p className="small code-ami-stats">{n === 0 ? t('codeAmi.gagnesZero', { montant: gagnes }) : t(n === 1 ? 'codeAmi.gagnesUn' : 'codeAmi.gagnesPlusieurs', { n, montant: gagnes })}</p>
      {attente > 0 && <p className="small code-ami-stats">{t(attente === 1 ? 'codeAmi.attenteUn' : 'codeAmi.attentePlusieurs', { n: attente })}</p>}
      <p className="small code-ami-conditions">{t(deux ? 'codeAmi.conditionsDeux' : 'codeAmi.conditionsSeul')}</p>
    </div>
  );
}

/* LE RAPPEL SUR L'ÉCRAN « COMMANDE CONFIRMÉE », une fois par téléphone (question 5 de la maquette : le moment où l'on est
 * content). Une rangée calme sous le récapitulatif, sans lime (le lime de l'écran est « Suivre ma commande ») : l'écran
 * tient toujours sur un écran (maquettes/merci-une-page). Compté comme vu dès qu'il s'affiche. */
export function RappelCodeAmi() {
  const { code, deux } = useCodeAmi();
  const { t } = useLanguage();
  const lancerPartage = usePartager();
  const [montre] = useState(() => !lire(CLE_RAPPEL));
  const visible = montre && !!code && deux;
  useEffect(() => { if (visible) noter(CLE_RAPPEL); }, [visible]);
  if (!visible) return null;
  return (
    <div className="code-ami-rappel">
      <span className="code-ami-rappel-icone" aria-hidden="true"><Icone nom="cadeau" taille={20} /></span>
      <span className="code-ami-rappel-texte"><b>{t('codeAmi.carteDeux')}</b><small>{t('codeAmi.ticket')} : {code}</small></span>
      <button type="button" className="code-ami-rappel-bouton" onClick={lancerPartage}>{t('codeAmi.partagerCourt')}</button>
    </div>
  );
}
