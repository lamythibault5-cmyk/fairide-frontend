import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiUpload } from '../../api';
import { useToast } from '../../context/ToastContext';
import { vibrer } from '../../gestes';

/* LES PRIX QUI MONTENT (Owen, 2026-11-08, version B « Avec preuve » de maquettes/carte-hausses/carte-hausses.html).
 *   1. Une hausse du prix d'un plat ou d'un supplément : le commerce joint une photo de son tableau des prix (ou de sa carte
 *      imprimée, de sa caisse) où on lit le nouveau prix. En ligne tout de suite ; l'équipe regarde la photo après, sous 48 h.
 *   2. Sans réponse de l'équipe dans le délai : le prix reste en ligne, avec le badge, sur la parole du commerce.
 *   3. La photo ne montre pas le prix : le commerce choisit (remettre l'ancien prix, une autre photo, ou garder le prix sans
 *      le badge « Prix du comptoir »).
 *   4. Une baisse, un nouveau plat : sur l'honneur, comme avant. Un plat remis sous le même nom, plus cher, est une hausse :
 *      le serveur répond PREUVE_REQUISE et la feuille demande la photo.
 * LA RÈGLE SUIT LE CONTRAT : seulement quand le serveur dit `regleHausses.photoRequise` (le commerce a accepté le contrat
 * RESTO-2026.25, publié le 08/11/2026) ; sinon une hausse reste sur l'honneur, exactement comme le 29/10 (AjoutPlat.jsx). Le
 * serveur reste seul juge : s'il exige une photo que l'écran n'a pas vue venir, il répond PREUVE_REQUISE et on la demande.
 * Ce fichier n'exporte que des crochets et des fonctions (rafraîchissement à chaud de Vite, comme ajoutPlatOutils.jsx). */

// La règle telle que le serveur l'envoie dans la fiche du titulaire ; absente = pas de photo, 48 h par défaut.
export function regleHausses(restaurant) {
  const r = restaurant?.regleHausses;
  const h = Number(r?.delaiHeures);
  return { photoRequise: r?.photoRequise === true, delaiHeures: Number.isFinite(h) && h > 0 ? h : 48 };
}

export const estPreuveRequise = (e) => e?.code === 'PREUVE_REQUISE' || e?.data?.code === 'PREUVE_REQUISE';

// Plus cher qu'aujourd'hui, au cent près : le prix AFFICHÉ (celui que le client paie) comparé à l'affiché d'aujourd'hui.
// La fiche ne donne pas l'ancien prix du comptoir ; pour une carte à hausse, l'affiché suit le comptoir dans le même sens.
export function estHausse(nouveauAffiche, actuel) {
  if (nouveauAffiche === null || nouveauAffiche === undefined || actuel === null || actuel === undefined) return false;
  return Number(nouveauAffiche) > Number(actuel) + 0.004;
}

// Le prix d'un supplément : 0 est permis (un supplément peut devenir gratuit), contrairement à un plat (lirePrix).
export function lirePrixSupplement(s) {
  const brut = String(s ?? '').trim();
  if (!brut) return null;
  const v = Number(brut.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
}

// Les suppléments payants d'une liste de groupes, aplatis (un supplément appartient à un seul groupe).
export function supplementsPayants(groupes) {
  return (groupes || []).flatMap((g) => (g.items || []).filter((i) => Number(i.priceDelta) > 0).map((i) => ({ ...i, groupe: g })));
}

const instant = (d) => { const n = typeof d === 'number' ? d : Date.parse(d); return Number.isFinite(n) ? n : 0; };
// Une déclaration vise un plat ou un supplément : la clé qui les sépare (un plat et un supplément peuvent avoir le même id).
export const cleDeclaration = (d) => (d?.optionItemId ? `o:${d.optionItemId}` : d?.itemId ? `p:${d.itemId}` : null);

/* Les déclarations du commerce (GET /menu/declarations). Seule la DERNIÈRE d'un plat ou d'un supplément compte : un refus
 * suivi d'une baisse n'appelle plus de choix. Le titulaire seul la lit (la route est réservée au titulaire). */
export function useDeclarations(restoId, token, actif) {
  const [liste, setListe] = useState([]);
  const charger = useCallback(() => {
    if (!actif) return Promise.resolve();
    return api(`/restaurants/${restoId}/menu/declarations`, { token })
      .then((r) => setListe(Array.isArray(r) ? r : Array.isArray(r?.declarations) ? r.declarations : []))
      .catch(() => { /* rien à montrer : la carte reste celle d'aujourd'hui */ });
  }, [restoId, token, actif]);
  useEffect(() => { charger(); }, [charger]);
  const derniere = useMemo(() => {
    const m = new Map();
    [...liste].sort((a, b) => instant(b.declaredAt) - instant(a.declaredAt)).forEach((d) => {
      const k = cleDeclaration(d);
      if (k && !m.has(k)) m.set(k, d);
    });
    return m;
  }, [liste]);
  // Refusée, pas encore choisie, pas déjà remise par le serveur (délai de choix passé).
  const refus = useMemo(() => [...derniere.values()].filter((d) => d.checkStatus === 'refusee' && !d.shopChoice && !d.restoredAt), [derniere]);
  return { charger, derniere, refus };
}

/* La photo-preuve : un champ fichier caché (appareil photo ou photothèque sur le téléphone, comme la photo d'un plat), envoyée
 * dès qu'elle est prise (POST /menu/proof) pour que la déclaration parte ensuite d'une touche. `apres(proofId)` : ce qu'on
 * en fait une fois reçue (la feuille la garde ; une carte de refus l'envoie à la déclaration). */
export function usePreuve(restoId, token, apres) {
  const toast = useToast();
  const champ = useRef(null);
  const [etat, setEtat] = useState({ proofId: null, apercu: null, envoi: false });
  useEffect(() => () => { if (etat.apercu) URL.revokeObjectURL(etat.apercu); }, [etat.apercu]);
  async function envoyer(f) {
    const apercu = URL.createObjectURL(f);
    setEtat({ proofId: null, apercu, envoi: true });
    try {
      const r = await apiUpload(`/restaurants/${restoId}/menu/proof`, { file: f, token });
      const proofId = r?.proofId ?? r?.id ?? null;
      setEtat({ proofId, apercu, envoi: false });
      vibrer('succes');
      await apres?.(proofId);
    } catch (e) {
      toast(e.message, 'erreur');
      setEtat({ proofId: null, apercu: null, envoi: false });
    }
  }
  const input = (
    <input ref={champ} type="file" accept="image/*" hidden onChange={(e) => {
      const f = e.target.files?.[0]; e.target.value = '';
      if (f) envoyer(f);
    }} />
  );
  return { ...etat, input, choisir: () => champ.current?.click(), oublier: () => setEtat({ proofId: null, apercu: null, envoi: false }) };
}
