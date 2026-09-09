import { useCallback, useEffect, useRef, useState } from 'react';
import { api, totalDepuisEntetes } from '../api';
import { useAuth } from '../context/AuthContext';

// Liste paginée côté serveur, façon « Afficher plus » : GET `${path}?q&sort&limit&offset(&extra)`,
// réponse = tableau + en-tête X-Total-Count (voir api.js). Utilisée par Restaurants, Livreurs, Clients :
// la recherche, le tri et les filtres serveur repartent de zéro (offset 0) ; « Afficher plus » ajoute
// la page suivante à la suite. `setRows` permet les mises à jour optimistes (statut, publication…).
//
// Une réponse qui arrive après un changement de filtre est ignorée (jeton de requête) : sans cela,
// une recherche lente pourrait écraser les résultats d'une recherche plus récente.
export default function useServerList(path, { q = '', sort = '', extra = {}, pageSize = 100 } = {}) {
  const { token } = useAuth();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const jeton = useRef(0);
  const extraKey = JSON.stringify(extra);

  const charger = useCallback(async (offset) => {
    const id = ++jeton.current;
    setLoading(true); setError(null);
    if (offset === 0) setRows(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    for (const [k, v] of Object.entries(JSON.parse(extraKey))) if (v !== undefined && v !== null && v !== '') params.set(k, v);
    params.set('limit', pageSize);
    params.set('offset', offset);
    try {
      const { data, headers } = await api(`${path}?${params.toString()}`, { token, withHeaders: true });
      if (id !== jeton.current) return;
      const liste = Array.isArray(data) ? data : (data?.rows || []);
      setTotal(totalDepuisEntetes(headers, liste) || (offset === 0 ? liste.length : 0));
      setRows((prev) => (offset === 0 || !prev ? liste : [...prev, ...liste]));
    } catch (e) {
      if (id !== jeton.current) return;
      setError(e.message);
      if (offset === 0) setRows([]);
    } finally {
      if (id === jeton.current) setLoading(false);
    }
  }, [path, q, sort, extraKey, pageSize, token]);

  useEffect(() => { charger(0); }, [charger]);

  const reload = useCallback(() => charger(0), [charger]);
  const loadMore = useCallback(() => charger(rows ? rows.length : 0), [charger, rows]);
  return { rows, setRows, total, loading, error, reload, loadMore };
}
