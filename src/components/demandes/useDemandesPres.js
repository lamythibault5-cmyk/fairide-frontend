import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chargerPres } from '../../demandes';

/* LES DEMANDÉS PRÈS DE TOI, LUS UNE FOIS POUR TOUT L'ACCUEIL (accueil plein, fondateur 2026-11-12, maquettes/accueil-plein
 * section 5). La rangée sous « Autour de toi » et le rappel au milieu de « Tous les commerces » montrent les mêmes demandes ;
 * un « Moi aussi » dans l'une se voit dans l'autre (`maj`). `nombre` : combien en tout autour du client, pour « Voir les N »
 * (un serveur d'avant le 12/11 ne le donne pas : la longueur de la liste en tient lieu). */
export const PAR_RANGEE_DEMANDES = 8;
export default function useDemandesPres() {
  const { user, token } = useAuth();
  const [liste, setListe] = useState([]);
  const [nombre, setNombre] = useState(0);
  const charger = useCallback(() => chargerPres(user, token, PAR_RANGEE_DEMANDES)
    .then((r) => { const l = r.demandes || []; setListe(l); setNombre(Number.isFinite(r.nombre) ? r.nombre : l.length); })
    .catch(() => {}), [user, token]);
  useEffect(() => { charger(); }, [charger]);
  const maj = useCallback((suivant) => setListe((l) => l.map((x) => (x.id === suivant.id ? { ...x, ...suivant } : x))), []);
  return { liste, nombre, charger, maj };
}
