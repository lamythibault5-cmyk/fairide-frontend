import { useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { categoryLabel } from '../../menuCategories';
import { euros } from '../../prixPlat';
import { vibrer } from '../../gestes';
import Modale from '../Modale';
import ConfirmDialog from '../ConfirmDialog';
import Icone from '../Icone';
import { supplementsPayants, usePreuve } from './haussesOutils';

/* CE QUE LE COMMERCE VOIT DES HAUSSES ET CE QU'IL CHANGE LUI-MÊME (Owen, 2026-11-08, maquettes/carte-hausses, version B et
 * section 3 « Les textes »). Le pourquoi de la règle est en tête de haussesOutils.jsx. Ici :
 *   - EtatHausse : la petite ligne sous le prix d'un plat ou d'un supplément, vue du commerce seul (les clients ne voient
 *     rien de spécial, décision 6) : « Photo envoyée · l'équipe regarde sous 48 h », puis « Photo pas encore vérifiée » si
 *     l'équipe n'a pas répondu à temps, ou « Photo à revoir » qui ouvre le choix ;
 *   - RefusHausse : la carte du choix quand la photo ne montre pas le prix (en tête de Ta carte, et ouverte depuis le plat) ;
 *   - FeuilleTextes : nom, description, section, en ligne d'une touche ; l'équipe voit passer chaque changement et peut le
 *     remettre (« Changements de texte » dans Admin › Cartes) ;
 *   - SupplementsCarte : les suppléments payants, leur prix touchable (même feuille que le prix d'un plat). */

const dateHeure = (d) => {
  const n = typeof d === 'number' ? d : Date.parse(d);
  return Number.isFinite(n) ? new Date(n).toLocaleString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
};
// L'ancien prix à remettre : celui du comptoir si le serveur le donne, sinon l'ancien prix affiché (le même pour une carte
// au badge, la seule où le choix « sans le badge » existe).
const ancienPrix = (d) => d.previousCounter ?? d.previousCounterPrice ?? d.previousPrice;
const prixLu = (d, v) => (v === null || v === undefined ? '' : `${d.optionItemId ? '+' : ''}${euros(v)}`);

export function EtatHausse({ d, h, onRefus }) {
  const { t } = useLanguage();
  if (!d?.checkStatus) return null;
  if (d.checkStatus === 'a_verifier') return <small className="ec-hausse-etat"><Icone nom="photo" taille={12} />{t('hausses.ligneAVerifier', { h })}</small>;
  if (d.checkStatus === 'sans_reponse') return <small className="ec-hausse-etat"><Icone nom="horloge" taille={12} />{t('hausses.ligneSansReponse')}</small>;
  if (d.checkStatus === 'refusee' && !d.shopChoice && !d.restoredAt) {
    return (
      <button type="button" className="ec-hausse-etat ec-hausse-etat--refus" onClick={() => onRefus?.(d)}>
        <Icone nom="alerte" taille={12} />{t('hausses.ligneRefusee')}
      </button>
    );
  }
  return null;
}

// `lime` : la carte en tête de Ta carte porte le bouton lime de l'écran (« Ajouter un plat » passe alors en iris).
export function RefusHausse({ d, restoId, token, badge, onFait, lime = true }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [envoi, setEnvoi] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const nouveau = prixLu(d, d.counterPrice);
  const ancien = prixLu(d, ancienPrix(d));
  const preuve = usePreuve(restoId, token, async (proofId) => {
    if (!proofId) return;
    await api(`/restaurants/${restoId}/menu/declarations/${d.id}/proof`, { method: 'POST', token, body: { proofId } });
    toast(t('hausses.autrePhotoOk'), 'succes');
    await onFait?.();
  });
  async function choisir(choice) {
    setEnvoi(true);
    try {
      await api(`/restaurants/${restoId}/menu/declarations/${d.id}/choice`, { method: 'POST', token, body: { choice } });
      vibrer('succes');
      toast(choice === 'ancien_prix' ? t('hausses.remisOk', { prix: ancien }) : t('hausses.sansBadgeFait', { prix: nouveau }), 'succes');
      setConfirmer(false);
      await onFait?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }
  const delai = d.choiceDueAt ? dateHeure(d.choiceDueAt) : '';
  return (
    <section className="ec-refus" aria-label={t('hausses.refusTitre', { prix: nouveau, plat: d.itemName || '' })}>
      <p className="ec-refus-titre"><Icone nom="alerte" taille={18} />{t('hausses.refusTitre', { prix: nouveau, plat: d.itemName || '' })}</p>
      {d.checkNote && <p className="ec-refus-note">{t('hausses.refusNote', { note: d.checkNote })}</p>}
      {delai && ancien && <p className="ec-refus-delai">{t('hausses.refusDelai', { date: delai, ancien })}</p>}
      {ancien && (
        <button type="button" className={`ec-bouton ${lime ? 'ec-bouton--lime' : 'ec-bouton--iris'}`} disabled={envoi} onClick={() => choisir('ancien_prix')}>
          {t('hausses.refusRemettre', { ancien })}
        </button>
      )}
      <button type="button" className="ec-bouton ec-bouton--contour" disabled={envoi || preuve.envoi} onClick={preuve.choisir}>
        <Icone nom="photo" taille={18} />{preuve.envoi ? t('hausses.photoEnvoi') : t('hausses.refusPhoto')}
      </button>
      {/* Le troisième choix n'existe que pour une carte qui porte le badge : sans badge, il n'y a rien à retirer. */}
      {badge && (
        <>
          <button type="button" className="ec-bouton ec-bouton--texte" disabled={envoi} onClick={() => setConfirmer(true)}>{t('hausses.refusSansBadge', { prix: nouveau })}</button>
          <p className="ec-refus-sous">{t('hausses.refusSansBadgeSous')}</p>
        </>
      )}
      {preuve.input}
      <ConfirmDialog open={confirmer} title={t('hausses.sansBadgeTitre', { prix: nouveau })} message={t('hausses.sansBadgeTexte')} icone="etiquette"
        confirmLabel={t('hausses.sansBadgeOk')} danger loading={envoi} onCancel={() => setConfirmer(false)} onConfirm={() => choisir('sans_badge')} />
    </section>
  );
}

// Le choix ouvert depuis la ligne d'un plat : la même carte, dans une fenêtre.
export function FenetreRefus({ d, onFermer, ...reste }) {
  const { t } = useLanguage();
  return (
    <Modale ariaLabel={t('hausses.ligneRefusee')} onFermer={onFermer} classeBoite="ec-ajout">
      <div className="ec-ajout-haut">
        <b />
        <button type="button" className="ec-ajout-fermer" onClick={onFermer} aria-label={t('carteAjout.fermer')}><Icone nom="croix" taille={16} /></button>
      </div>
      <RefusHausse d={d} {...reste} onFait={async () => { await reste.onFait?.(); onFermer(); }} />
    </Modale>
  );
}

/* LE NOM, LA DESCRIPTION, LA SECTION (décision 5) : une feuille, une touche, en ligne. Seuls les champs changés partent
 * (PATCH /menu/:itemId/textes). « Retirer de la carte » reste au bas de la feuille : c'était le geste du nom touché. */
export function FeuilleTextes({ restoId, token, restaurant, plat, onFermer, onFait, onRetirer, onPrixSupplement }) {
  const { t } = useLanguage();
  const toast = useToast();
  const sections = (restaurant.sections || []).map((s) => s.name);
  const [nom, setNom] = useState(plat.name || '');
  const [desc, setDesc] = useState(plat.desc || '');
  const [section, setSection] = useState(plat.category || sections[0] || '');
  const [nouvelle, setNouvelle] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const supplements = supplementsPayants(plat.optionGroups);

  async function enregistrer() {
    if (!nom.trim()) { toast(t('carteAjout.manqueNom'), 'erreur'); return; }
    if (!section.trim()) { toast(t('carteAjout.manqueSection'), 'erreur'); return; }
    const body = {};
    if (nom.trim() !== (plat.name || '')) body.name = nom.trim();
    if (desc.trim() !== (plat.desc || '')) body.desc = desc.trim();
    if (section.trim() !== (plat.category || '')) body.category = section.trim();
    if (!Object.keys(body).length) { onFermer(); return; }
    setEnvoi(true);
    try {
      const r = await api(`/restaurants/${restoId}/menu/${plat.id}/textes`, { method: 'PATCH', token, body });
      vibrer('succes');
      toast(r?.carteASigner ? t('carteAjout.faitASigner') : t('hausses.textesEnLigne'), 'succes');
      await onFait?.();
      onFermer();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }

  return (
    <Modale ariaLabel={t('hausses.textesTitre')} onFermer={onFermer} classeBoite="ec-ajout">
      <div className="ec-ajout-haut">
        <b>{t('hausses.textesTitre')}</b>
        <button type="button" className="ec-ajout-fermer" onClick={onFermer} aria-label={t('carteAjout.fermer')}><Icone nom="croix" taille={16} /></button>
      </div>
      <div className="ec-ajout-form">
        <label className="ec-ajout-etiquette" htmlFor="textes-nom">{t('carteAjout.nom')}</label>
        <input id="textes-nom" value={nom} maxLength={120} onChange={(e) => setNom(e.target.value)} />
        <label className="ec-ajout-etiquette" htmlFor="textes-desc">{t('carteAjout.description')}</label>
        <textarea id="textes-desc" rows={3} value={desc} maxLength={600} onChange={(e) => setDesc(e.target.value)} style={{ resize: 'vertical' }} />
        <span className="ec-ajout-etiquette">{t('carteAjout.section')}</span>
        <div className="ec-ajout-pastilles" role="radiogroup" aria-label={t('carteAjout.section')}>
          {sections.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={!nouvelle && section === s} className={!nouvelle && section === s ? 'on' : ''}
              onClick={() => { setNouvelle(false); setSection(s); }}>{categoryLabel(s, t)}</button>
          ))}
          <button type="button" role="radio" aria-checked={nouvelle} className={nouvelle ? 'on' : ''}
            onClick={() => { setNouvelle(true); setSection(''); }}>{t('carteAjout.sectionNouvelle')}</button>
        </div>
        {nouvelle && <input aria-label={t('carteAjout.sectionNom')} placeholder={t('carteAjout.sectionNom')} value={section} maxLength={80} autoFocus onChange={(e) => setSection(e.target.value)} />}
        {/* Ses suppléments payants : leur prix se touche ici aussi (maquette, section 3), et suit la règle des prix. */}
        {onPrixSupplement && supplements.length > 0 && (
          <>
            <span className="ec-ajout-etiquette">{t('hausses.supplementsDuPlat')}</span>
            {supplements.map((s) => (
              <div key={s.id} className="ec-supp">
                <span>{s.name}</span>
                <button type="button" className="ec-plat-prix" onClick={() => onPrixSupplement(s)} aria-label={t('carteAjout.changerPrix', { name: s.name })}>
                  +{euros(s.priceDelta)}<Icone nom="crayon" taille={12} />
                </button>
              </div>
            ))}
            <p className="ec-ajout-sous" style={{ marginTop: 6 }}>{t('hausses.supplementsSous')}</p>
          </>
        )}
        <button type="button" className="ec-bouton ec-bouton--lime" disabled={envoi} onClick={enregistrer}>{envoi ? '…' : t('hausses.textesEnregistrer')}</button>
        {onRetirer && <button type="button" className="ec-bouton ec-bouton--texte" onClick={() => { onFermer(); onRetirer(plat); }}>{t('hausses.retirer')}</button>}
      </div>
    </Modale>
  );
}

// Les suppléments payants de la carte, par groupe : un prix pour tous les plats qui proposent le groupe.
export function SupplementsCarte({ restaurant, onPrix, derniere, h, onRefus }) {
  const { t } = useLanguage();
  const menu = restaurant.menu || [];
  const groupes = (restaurant.optionGroups || []).map((g) => ({ ...g, payants: (g.items || []).filter((i) => Number(i.priceDelta) > 0) })).filter((g) => g.payants.length);
  if (!groupes.length) return null;
  return (
    <section className="ec-supplements" aria-labelledby="ec-supplements-titre">
      <h2 className="ec-section-titre" id="ec-supplements-titre">{t('hausses.supplementsTitre')}</h2>
      <p className="ec-ajout-sous">{t('hausses.supplementsSous')}</p>
      {groupes.map((g) => {
        const n = menu.filter((m) => (m.optionGroups || []).some((x) => x.id === g.id)).length;
        return (
          <div key={g.id} className="ec-supp-groupe">
            <p className="ec-sous-section">{g.name}{n > 0 && <span className="ec-supp-compte"> · {n === 1 ? t('hausses.supplementSurPlat') : t('hausses.supplementSurPlats', { n })}</span>}</p>
            {g.payants.map((s) => (
              <div key={s.id} className="ec-supp">
                <span className="ec-supp-nom">
                  {s.name}
                  <EtatHausse d={derniere.get(`o:${s.id}`)} h={h} onRefus={onRefus} />
                </span>
                {onPrix
                  ? (
                    <button type="button" className="ec-plat-prix" onClick={() => onPrix({ ...s, groupe: g, nbPlats: n })} aria-label={t('carteAjout.changerPrix', { name: s.name })}>
                      +{euros(s.priceDelta)}<Icone nom="crayon" taille={12} />
                    </button>
                  )
                  : <span>+{euros(s.priceDelta)}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
