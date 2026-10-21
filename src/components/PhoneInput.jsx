import { useMemo, useState } from 'react';
import { useLanguage, getLocale } from '../context/LanguageContext';

// Numéro de téléphone en deux parties : le pays (liste déroulante des 27 pays de l'UE et du Royaume-Uni, Belgique par
// défaut) et le numéro local. La valeur remontée est toujours internationale (« +32 470 00 00 00 ») : le serveur la
// ramène en E.164 (phone.js) pour l'unicité et la vérification. Un 0 de tête tapé par habitude
// (« 0470… », « 07700… ») est retiré, sauf pour l'Italie où il fait partie du numéro.
// ROYAUME-UNI (17 oct. 2026, Owen) : beaucoup de Britanniques à Bruxelles. Aucun SMS ne part vers +44 (backend sms.js,
// SMS_PAYS_AUTORISES) : le code arrive par e-mail, comme pour tout numéro hors Belgique et voisins.
export const PAYS = [
  ['BE', '32'], ['FR', '33'], ['NL', '31'], ['LU', '352'], ['DE', '49'], ['ES', '34'], ['IT', '39'], ['PT', '351'],
  ['AT', '43'], ['BG', '359'], ['HR', '385'], ['CY', '357'], ['CZ', '420'], ['DK', '45'], ['EE', '372'], ['FI', '358'],
  ['GR', '30'], ['HU', '36'], ['IE', '353'], ['LV', '371'], ['LT', '370'], ['MT', '356'], ['PL', '48'], ['RO', '40'],
  ['SK', '421'], ['SI', '386'], ['SE', '46'], ['GB', '44']
];
const DEFAUT = 'BE';
// PLUS DE DRAPEAUX (audit du 19/10, auth-26 et LIVE-22) : ils étaient des émojis (lettres régionales), contraires à la règle
// « aucun émoji » du fondateur, et Windows les affichait en paires de lettres. Le code du pays (« BE +32 ») dit la même chose.

// Découpe une valeur existante (« +33 6 12… », « 0470 00 00 00 », vide) en pays + numéro local.
export function decouper(valeur) {
  const v = String(valeur || '').trim();
  const m = v.match(/^(?:\+|00)(\d{1,3})[\s./-]*(.*)$/);
  if (m) {
    // Indicatif le plus long qui correspond (ex. 35x avant 3).
    const candidats = PAYS.filter(([, d]) => (m[1] + m[2].replace(/\D/g, '')).startsWith(d)).sort((a, b) => b[1].length - a[1].length);
    if (candidats.length) { const [iso, d] = candidats[0]; const reste = (m[1] + m[2]).replace(/^\s*/, ''); return { iso, local: reste.startsWith(d) ? reste.slice(d.length).trim() : m[2].trim() }; }
    return { iso: DEFAUT, local: v };
  }
  return { iso: DEFAUT, local: v };
}

// INDICATIF TAPÉ OU COLLÉ DANS LA CASE DU NUMÉRO (audit du 19/10/2026, auth-01). Un contact copié (« +32470123456 »), un
// remplissage automatique ou « 0032 470… », « +32 (0)470… » partaient en « +32 +32470123456 », que le serveur lisait
// +3232470123456 : un faux numéro, alors que la case affichait le bon. L'indicatif en tête de la case est donc retiré et
// devient le pays (le même, ou un autre : « +33 6… » avec la Belgique choisie passe en France). Tant que l'indicatif
// n'est pas complet (« +3 », « 00 »), la saisie reste telle quelle.
function indicatifEnTete(n) {
  const m = n.match(/^(?:\+|00)\s*(.*)$/);
  if (!m) return null;
  const chiffres = m[1].replace(/\D/g, '');
  const pays = PAYS.filter(([, d]) => chiffres.startsWith(d)).sort((a, b) => b[1].length - a[1].length)[0];
  if (!pays) return null;
  // Retire les chiffres de l'indicatif en gardant la mise en forme du reste (« 470 12 34 56 »).
  let i = 0;
  for (let vus = 0; vus < pays[1].length; i++) if (/\d/.test(m[1][i])) vus++;
  return { iso: pays[0], dial: pays[1], reste: m[1].slice(i).replace(/^[\s./-]*/, '').replace(/^\(\s*0\s*\)\s*/, '') };
}

export function composer(iso, local) {
  let [, dial] = PAYS.find(([i]) => i === iso) || ['BE', '32'];
  let n = String(local || '').trim();
  if (!n) return '';
  const tete = indicatifEnTete(n);
  if (tete) {
    ({ iso, dial } = tete);
    n = tete.reste;
  } else if (/^(?:\+|00)/.test(n)) {
    return `+${dial} ${n}`;
  }
  if (iso !== 'IT') n = n.replace(/^0(?=\d)/, '');
  return `+${dial} ${n}`.trim();
}

export default function PhoneInput({ id, value, onChange, invalid = false, placeholder, autoComplete = 'tel-national' }) {
  const { t } = useLanguage();
  const lu = useMemo(() => decouper(value), [value]);
  // LE PAYS CHOISI SE GARDE ICI tant que le numéro est vide. La valeur remontée réunit pays et numéro ; sans numéro,
  // composer() rend '' et le pays tiré de cette valeur retombait sur la Belgique : choisir +44 avant de taper ne
  // changeait rien à l'écran (signalé par Owen, 17 oct. 2026). Dès qu'un numéro existe, c'est lui qui dit le pays.
  const [paysChoisi, setPaysChoisi] = useState(lu.iso);
  const iso = lu.local ? lu.iso : paysChoisi;
  const local = lu.local;
  const noms = useMemo(() => { try { return new Intl.DisplayNames([getLocale()], { type: 'region' }); } catch { return null; } }, []);
  const liste = useMemo(() => PAYS.map(([i, d]) => ({ iso: i, dial: d, nom: noms?.of(i) || i })).sort((a, b) => (a.iso === DEFAUT ? -1 : b.iso === DEFAUT ? 1 : a.nom.localeCompare(b.nom))), [noms]);
  const [, dial] = PAYS.find(([i]) => i === iso) || ['BE', '32'];
  return (
    <div className={`phone-input${invalid ? ' input-invalid' : ''}`}>
      <select className="phone-input-pays" aria-label={t('phoneInput.country')} value={iso} onChange={(e) => { setPaysChoisi(e.target.value); onChange(composer(e.target.value, local)); }}>
        {liste.map((p) => <option key={p.iso} value={p.iso}>{p.nom} (+{p.dial})</option>)}
      </select>
      <span className="phone-input-indicatif" aria-hidden="true">{iso} +{dial}</span>
      <input id={id} type="tel" inputMode="tel" autoComplete={autoComplete} value={local} placeholder={placeholder || (iso === 'BE' ? '470 00 00 00' : '')}
        onChange={(e) => { const v = composer(iso, e.target.value); setPaysChoisi(v ? decouper(v).iso : iso); onChange(v); }} />
    </div>
  );
}
