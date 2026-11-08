import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { estNatif } from '../../natif';
import { euros } from '../../prixPlat';
import Icone from '../Icone';
import '../../ecran-equipe-groupe.css';

/* « QUI TE DOIT QUOI » — APRÈS LA COMMANDE GROUPÉE (fondateur, 2026-11-08, maquettes/bienvenue-partage). L'hôte a payé tout le
 * groupe : sur « Commande confirmée », ce que chaque invité lui doit, prêt à envoyer d'un geste (WhatsApp, Messages…). Chaque
 * part = ses plats au prix payé (l'offre du commerce répartie comme sur la commande : plats du groupe × sous-total payé /
 * total des plats du groupe) + sa part égale de la livraison. Le crédit de bienvenue et le solde de l'hôte restent à l'hôte.
 * Rien n'est encaissé par Fairride : c'est un calcul pour s'arranger entre amis. `commande` : la ligne de GET /orders/mine,
 * dont `groupCode` (commande d'un groupe, hôte seulement). */
export default function QuiDoitQuoi({ commande }) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [groupe, setGroupe] = useState(null);
  const code = commande?.groupCode;
  useEffect(() => {
    if (!code || !token) return;
    api(`/group-orders/${encodeURIComponent(code)}`, { token }).then((g) => { if (g?.isHost) setGroupe(g); }).catch(() => {});
  }, [code, token]);
  if (!groupe) return null;

  const lignes = groupe.lines || [];
  const totalPlats = lignes.reduce((a, l) => a + Number(l.unitPrice) * l.qty, 0);
  const autres = lignes.filter((l) => !l.mine);
  if (!autres.length || totalPlats <= 0) return null;
  const parPersonne = new Map();
  for (const l of autres) {
    const p = parPersonne.get(l.guestName) || { nom: l.guestName, plats: [], montant: 0 };
    p.plats.push(l.qty > 1 ? `${l.qty}× ${l.name}` : l.name);
    p.montant += Number(l.unitPrice) * l.qty;
    parPersonne.set(l.guestName, p);
  }
  const echelle = Number(commande.subtotal) > 0 ? Number(commande.subtotal) / totalPlats : 1;
  const personnes = [...parPersonne.values()];
  const livraison = commande.orderType === 'delivery' ? Number(commande.deliveryFee || 0) - Number(commande.deliveryDiscount || 0) : 0;
  const partLivraison = livraison > 0 ? livraison / (personnes.length + 1) : 0;
  for (const p of personnes) p.du = +(p.montant * echelle + partLivraison).toFixed(2);
  const noms = personnes.map((p) => p.nom);
  const listeNoms = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} ${t('groupOrder.doitEt')} ${noms[noms.length - 1]}` : noms[0];

  async function envoyer() {
    const text = [t('groupOrder.doitMessage', { name: commande.restaurantName }), ...personnes.map((p) => `${p.nom} : ${euros(p.du)}`)].join('\n');
    try {
      if (estNatif()) { const { Share } = await import('@capacitor/share'); await Share.share({ title: 'Fairride', text }); return; }
      if (navigator.share) { await navigator.share({ title: 'Fairride', text }); return; }
      await navigator.clipboard.writeText(text);
      toast(t('groupOrder.doitCopie'), 'succes');
    } catch (e) {
      if (e?.name === 'AbortError' || /cancel/i.test(String(e?.message || ''))) return;
      toast(t('groupOrder.doitImpossible'), 'erreur');
    }
  }

  return (
    <div className="eg-doit">
      <div className="eg-doit-tete">
        <span className="eg-doit-rond" aria-hidden="true"><Icone nom="euro" taille={20} /></span>
        <span><b>{t('groupOrder.doitTitre')}</b><small>{t(partLivraison > 0 ? 'groupOrder.doitSousLivraison' : 'groupOrder.doitSous')}</small></span>
      </div>
      <ul className="eg-doit-liste">
        {personnes.map((p) => (
          <li key={p.nom}>
            <span className="eg-initiale" aria-hidden="true">{p.nom.trim().charAt(0).toUpperCase()}</span>
            <span className="eg-doit-qui"><b>{p.nom}</b><small>{p.plats.join(', ')}</small></span>
            <b className="eg-doit-montant">{euros(p.du)}</b>
          </li>
        ))}
      </ul>
      <button type="button" className="eg-doit-envoyer" onClick={envoyer}>{t('groupOrder.doitEnvoyer', { names: listeNoms })}</button>
    </div>
  );
}
