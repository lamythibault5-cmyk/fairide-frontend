import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { coucheTuiles } from '../../carte';
import { iconeHtml } from '../../iconeHtml';

/* LA CARTE D'UNE COURSE, SUR LE SITE SUR UN ORDINATEUR (fondateur, 2026-10-16, mockups/site-ordinateur.html, « Livreur ») :
 * à droite de la liste, le commerce (rond iris) et le client (rond lime) reliés par des pointillés iris, comme le trajet
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

function rond(nom, fond, encre) {
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;border-radius:50%;background:${fond};color:${encre};display:grid;place-items:center;border:2px solid #fff;">${iconeHtml(nom, 17)}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

// Créés au chargement du module, une fois pour toutes (iconeHtml écrit le SVG en texte, sans React, depuis le 2026-10-17).
const ICONE_COMMERCE = rond('commerce', '#3B2FB5', '#fff');
const ICONE_CLIENT = rond('maison', '#C8F03C', '#14121F');

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
      L.polyline(points, { color: '#3B2FB5', weight: 4, dashArray: '8 9', opacity: 0.9 }).addTo(calque.current);
      carte.current.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 16 });
    } else if (points.length === 1) {
      carte.current.setView(points[0], 15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a0, a1, b0, b1]);

  return <div ref={boite} className="ecl-carte-course" style={{ height: hauteur }} />;
}
