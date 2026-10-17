import { useMemo } from 'react';
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
const drapeau = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

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

export function composer(iso, local) {
  const [, dial] = PAYS.find(([i]) => i === iso) || ['BE', '32'];
  let n = String(local || '').trim();
  if (!n) return '';
  if (iso !== 'IT') n = n.replace(/^0(?=\d)/, '');
  return `+${dial} ${n}`.trim();
}

export default function PhoneInput({ id, value, onChange, invalid = false, placeholder, autoComplete = 'tel-national' }) {
  const { t } = useLanguage();
  const { iso, local } = useMemo(() => decouper(value), [value]);
  const noms = useMemo(() => { try { return new Intl.DisplayNames([getLocale()], { type: 'region' }); } catch { return null; } }, []);
  const liste = useMemo(() => PAYS.map(([i, d]) => ({ iso: i, dial: d, nom: noms?.of(i) || i })).sort((a, b) => (a.iso === DEFAUT ? -1 : b.iso === DEFAUT ? 1 : a.nom.localeCompare(b.nom))), [noms]);
  const [, dial] = PAYS.find(([i]) => i === iso) || ['BE', '32'];
  return (
    <div className={`phone-input${invalid ? ' input-invalid' : ''}`}>
      <select className="phone-input-pays" aria-label={t('phoneInput.country')} value={iso} onChange={(e) => onChange(composer(e.target.value, local))}>
        {liste.map((p) => <option key={p.iso} value={p.iso}>{drapeau(p.iso)} {p.nom} (+{p.dial})</option>)}
      </select>
      <span className="phone-input-indicatif" aria-hidden="true">{drapeau(iso)} +{dial}</span>
      <input id={id} type="tel" inputMode="tel" autoComplete={autoComplete} value={local} placeholder={placeholder || (iso === 'BE' ? '470 00 00 00' : '')}
        onChange={(e) => onChange(composer(iso, e.target.value))} />
    </div>
  );
}
