import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '../context/LanguageContext';
import { escapeHtml } from '../escapeHtml';

// Carte du CRM commerçants (pages/client/CrmPage.jsx) : mes commerces démarchés (pin coloré par étape), ceux des
// autres commerciaux (petit point gris : on ne frappe pas deux fois à la même porte) et les zones proposées
// (cercles ; salesZones.js côté serveur). Même bibliothèque et mêmes classes de pins que RestaurantsMap.
const BRUSSELS_CENTER = [50.8420, 4.3700];
// Couleur du pin selon l'étape : gris (à contacter), bleu (en cours), or (rendez-vous), iris (inscrit), vert (actif), rouge (refus).
const COULEURS = { a_contacter: '#8A8A8A', contacte: '#3B7DD8', interesse: '#3B7DD8', rdv: '#F5B800', inscrit: '#3B2FB5', carte_en_ligne: '#3B2FB5', actif: '#0F8049', plus_tard: '#8A8A8A', refuse: '#C8243A' };

function pinProspect(p, icone, actif) {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<div class="map-pin crm-pin${actif ? ' active' : ''}" style="background:${COULEURS[p.stage] || '#8A8A8A'}"><span class="map-pin-emoji">${icone || '📍'}</span></div>`,
    iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -30]
  });
}
function pointAutre() {
  return L.divIcon({ className: 'map-pin-wrap', html: '<div class="crm-point-autre"></div>', iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -8] });
}

export default function CrmMap({ prospects, autres = [], zones = [], zoneActive = null, ouvert = null, stageIcones = {}, onOpen, onZone, height = 360 }) {
  const { t } = useLanguage();
  const conteneur = useRef(null);
  const carte = useRef(null);
  const couches = useRef({ prospects: L.layerGroup(), autres: L.layerGroup(), zones: L.layerGroup() });
  const recadrer = useRef(null);
  const rappels = useRef({ onOpen, onZone });
  rappels.current = { onOpen, onZone };

  useEffect(() => {
    if (!conteneur.current || carte.current) return undefined;
    carte.current = L.map(conteneur.current, { scrollWheelZoom: false }).setView(BRUSSELS_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(carte.current);
    Object.values(couches.current).forEach((c) => c.addTo(carte.current));
    // Voir RestaurantsMap : Leaflet mesure son conteneur à l'init ; on recalcule à chaque changement de taille.
    const observateur = new ResizeObserver(() => { carte.current?.invalidateSize(); });
    observateur.observe(conteneur.current);
    return () => { observateur.disconnect(); carte.current?.remove(); carte.current = null; };
  }, []);

  // Zones : un cercle cliquable, plus marqué pour la zone choisie.
  useEffect(() => {
    const couche = couches.current.zones; couche.clearLayers();
    for (const z of zones) {
      const actif = zoneActive === z.key;
      const cercle = L.circle([z.lat, z.lng], { radius: z.radius, color: actif ? '#3B2FB5' : '#F5B800', weight: actif ? 3 : 2, fillColor: actif ? '#3B2FB5' : '#F5B800', fillOpacity: actif ? 0.12 : 0.07 });
      cercle.bindTooltip(`<b>${escapeHtml(z.name)}</b><br>${escapeHtml(t('sales.zoneMine', { n: z.mine }))} · ${escapeHtml(t('sales.zoneOthers', { n: z.others }))}`, { direction: 'top', sticky: true });
      cercle.on('click', () => rappels.current.onZone?.(actif ? null : z.key));
      couche.addLayer(cercle);
    }
  }, [zones, zoneActive, t]);

  // Mes commerces : un pin par commerce positionné ; clic → la fiche.
  useEffect(() => {
    const couche = couches.current.prospects; couche.clearLayers();
    const points = [];
    for (const p of prospects) {
      if (p.lat === null || p.lat === undefined || p.lng === null || p.lng === undefined) continue;
      const m = L.marker([p.lat, p.lng], { icon: pinProspect(p, stageIcones[p.stage], ouvert === p.id), zIndexOffset: ouvert === p.id ? 1000 : 0 });
      m.bindTooltip(`<b>${escapeHtml(p.name)}</b>${p.commune ? `<br>${escapeHtml(p.commune)}` : ''}`, { direction: 'top', offset: [0, -30] });
      m.on('click', () => rappels.current.onOpen?.(p.id));
      couche.addLayer(m); points.push([p.lat, p.lng]);
    }
    recadrer.current = () => {
      if (!carte.current) return;
      carte.current.invalidateSize();
      const z = zoneActive && zones.find((x) => x.key === zoneActive);
      if (z) { carte.current.fitBounds(L.latLng(z.lat, z.lng).toBounds(z.radius * 2.4)); return; }
      // Un seul commerce : un zoom de quartier, pas de rue (fitBounds sur un point unique irait au maximum).
      if (points.length === 1) carte.current.setView(points[0], 14);
      else if (points.length) carte.current.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 15 });
      else carte.current.setView(BRUSSELS_CENTER, 12);
    };
    recadrer.current();
  }, [prospects, ouvert, stageIcones, zoneActive, zones]);

  // Les commerces des autres commerciaux : de simples points, avec le prénom de qui les démarche.
  useEffect(() => {
    const couche = couches.current.autres; couche.clearLayers();
    for (const a of autres) {
      const m = L.marker([a.lat, a.lng], { icon: pointAutre(), interactive: true });
      m.bindTooltip(escapeHtml(t('sales.othersPin', { name: a.name, agent: a.agentName || '?' })), { direction: 'top', offset: [0, -8] });
      couche.addLayer(m);
    }
  }, [autres, t]);

  return (
    <div className="crm-carte-wrap">
      <div ref={conteneur} className="crm-carte-map" style={{ height }} aria-label={t('sales.mapTitle')} />
      <div className="crm-legende small">
        <span><i className="crm-leg-pin" style={{ background: '#3B7DD8' }} /> {t('sales.mapLegendMine')}</span>
        <span><i className="crm-leg-pin crm-leg-autre" /> {t('sales.mapLegendOthers')}</span>
        <span><i className="crm-leg-zone" /> {t('sales.mapLegendZones')}</span>
        <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => recadrer.current?.()}>{t('sales.mapRecenter')}</button>
      </div>
    </div>
  );
}
