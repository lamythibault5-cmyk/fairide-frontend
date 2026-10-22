import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { coucheTuiles } from '../../carte';
import { pastilleCommerce, pastilleMaison, TRACE_RESTE } from '../../marqueursCarte';

/* LA CARTE D'UNE COURSE, SUR LE SITE SUR UN ORDINATEUR (fondateur, 2026-10-16, maquettes/site-ordinateur/site-ordinateur.html, « Livreur ») :
 * à droite de la liste, le commerce (rond cerclé d'iris) et le client (rond lime) reliés par des points iris, comme le trajet
 * dessiné sur chaque carte de course.
 *
 * VOLONTAIREMENT LÉGÈRE. Aucun itinéraire demandé au serveur (GET /geo/route) : on change de course d'un clic, et chaque clic
 * aurait coûté un calcul ; le guidage reste celui de Waze, de Google Maps ou de la page Carte (DriverNavigationMap). Avant la
 * prise, le point du client est celui que le serveur arrondit (offreSansDonneesClient, ~100 m) : la carte ne dit pas plus
 * que l'adresse approximative écrite à côté.
 *
 * Chargée par React.lazy depuis Dashboard.jsx, et seulement dans la mise en page large du site : un téléphone, et l'app, ne
 * téléchargent pas Leaflet pour le tableau de bord. Les adresses sont écrites à côté : la carte ne porte aucune information qui manque au texte. */
const BRUXELLES = [50.8466, 4.3528];

// Les pastilles des cartes de suivi (marqueursCarte.js, audit « Look and feel », 2026-10-19) : le commerce cerclé d'iris, le
// client lime, chacun avec son anneau blanc.
const ICONE_COMMERCE = pastilleCommerce();
const ICONE_CLIENT = pastilleMaison();

const valide = (p) => p && p[0] != null && p[1] != null && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));

export default function CarteCourse({ depart, arrivee, hauteur = 280 }) {
  const boite = useRef(null);
  const carte = useRef(null);
  const calque = useRef(null);

  useEffect(() => {
    if (!boite.current || carte.current) return undefined;
    carte.current = L.map(boite.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView(BRUXELLES, 13);
    coucheTuiles(L).addTo(carte.current);
    L.control.zoom({ position: 'bottomright' }).addTo(carte.current);
    calque.current = L.layerGroup().addTo(carte.current);
    // Même parade que DriverNavigationMap : la colonne peut changer de largeur après l'ouverture (police, barre latérale).
    const obs = new ResizeObserver(() => carte.current?.invalidateSize());
    obs.observe(boite.current);
    return () => { obs.disconnect(); carte.current?.remove(); carte.current = null; calque.current = null; };
  }, []);

  const [a0, a1] = depart || [];
  const [b0, b1] = arrivee || [];
  useEffect(() => {
    if (!carte.current || !calque.current) return;
    calque.current.clearLayers();
    const points = [];
    if (valide(depart)) { points.push([Number(a0), Number(a1)]); L.marker(points[points.length - 1], { icon: ICONE_COMMERCE, keyboard: false }).addTo(calque.current); }
    if (valide(arrivee)) { points.push([Number(b0), Number(b1)]); L.marker(points[points.length - 1], { icon: ICONE_CLIENT, keyboard: false }).addTo(calque.current); }
    if (points.length === 2) {
      L.polyline(points, TRACE_RESTE).addTo(calque.current);
      carte.current.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 16 });
    } else if (points.length === 1) {
      carte.current.setView(points[0], 15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a0, a1, b0, b1]);

  return <div ref={boite} className="ecl-carte-course" style={{ height: hauteur }} />;
}
