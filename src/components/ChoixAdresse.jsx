import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import SousEcran from './SousEcran';
import AddressSearch from './AddressSearch';
import Icone from './Icone';
import { positionPrecise } from '../natif';
import { LIBELLES_RESERVES, nomAdresse, rueAdresse } from '../nomAdresse';

// LE CARNET D'ADRESSES : choisir où livrer, ou en ajouter une.
//
// Un compte n'avait qu'UNE adresse. Quelqu'un qui commande tantôt chez lui, tantôt au bureau devait
// la retaper à chaque fois — et comme rien ne la vérifiait, il pouvait y mettre n'importe quoi.
//
// Cet écran est calqué sur celui d'Uber Eats (capture du fondateur) : une recherche en haut, la liste
// des adresses enregistrées en dessous, celle en cours mise en évidence. Il s'ouvre des deux endroits
// où la question se pose — la liste des commerces, et le paiement — parce que c'est la même question.
//
// CE QUI ENTRE ICI EXISTE VRAIMENT. Le serveur géocode avant d'enregistrer et refuse une adresse
// qu'il ne connaît pas (POST /auth/me/addresses). C'était le trou : la commande refusait bien une
// fausse adresse, mais Mon compte l'enregistrait sans rien vérifier, et c'est cette adresse-là que
// tout le reste affichait. La vérification vit maintenant au point d'écriture, pas à l'arrivée.
// `onSaisieManuelle` (paiement) : l'adresse introuvable par la recherche se tape à la main, champ par champ.
// `depuisPosition` (2026-11-08) : ouvert par la bulle « Tu es à 4,2 km de … › Livrer à ma position » (BulleAdresseLoin.jsx) :
// le carnet part tout de suite sur « Utiliser ma position ».
export default function ChoixAdresse({ onFermer, onChoisie, onSaisieManuelle, depuisPosition = false }) {
  const { t } = useLanguage();
  const { token, user, refreshUser } = useAuth();
  const toast = useToast();
  const [adresses, setAdresses] = useState(null);
  const [occupe, setOccupe] = useState(false);
  // Suggestion retenue mais sans numéro : on reste sur l'écran et on demande le numéro.
  const [aCompleter, setACompleter] = useState(null);
  const [numero, setNumero] = useState('');
  // L'erreur s'affiche DANS la feuille, à côté du champ. Un toast ne suffisait pas : il vit au bas de
  // la page, derrière une feuille qui couvre l'écran — le message partait bien, mais on ne le voyait
  // jamais. Et même visible, le bon endroit pour dire « ce numéro n'existe pas » est sous le champ
  // qui le porte, pas une bulle qui disparaît au bout de cinq secondes.
  const [erreur, setErreur] = useState('');
  // « Utiliser ma position » : la recherche en cours, puis ce qui l'a fait échouer (affiché sous la rangée).
  const [chercheIci, setChercheIci] = useState(false);
  const [erreurIci, setErreurIci] = useState('');
  /* MAISON ET TRAVAIL (fondateur, 2026-11-08, maquette retours-08-11). `cible` : on est en train de choisir l'adresse de
   * la Maison ou du Travail (« Ajouter » ou « Changer » sur sa rangée) : la prochaine adresse ajoutée la prend, et toucher
   * une adresse enregistrée lui donne ce nom au lieu de la choisir. `libelle` : le nom choisi à l'étape d'enregistrement
   * (pastilles Maison / Travail / Autre). */
  const [cible, setCible] = useState(null);
  const [libelle, setLibelle] = useState('');

  useEffect(() => {
    if (depuisPosition) depuisMaPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api('/auth/me/addresses', { token })
      .then(setAdresses)
      .catch(() => setAdresses([]));
  }, [token]);

  // L'adresse en cours sur le compte, pour la marquer dans la liste : on doit voir d'un coup d'œil
  // laquelle est retenue, sinon on ne sait pas si on vient de changer quelque chose.
  const enCours = (a) =>
    (user.addressStreet || '').toLowerCase() === (a.street || '').toLowerCase()
    && (user.addressNumber || '').toLowerCase() === (a.number || '').toLowerCase();

  // Les adresses nommées Maison et Travail sont épinglées en haut ; les autres dessous. En mode choix (`cible`), toutes
  // celles qui ne portent pas déjà ce nom sont proposées.
  const fixes = {
    maison: (adresses || []).find((a) => a.label === 'maison') || null,
    travail: (adresses || []).find((a) => a.label === 'travail') || null
  };
  const autres = (adresses || []).filter((a) => (cible ? a.label !== cible : !LIBELLES_RESERVES.includes(a.label)));

  async function choisir(a) {
    if (occupe) return;
    setOccupe(true);
    try {
      const r = await api(`/auth/me/addresses/${a.id}/select`, { method: 'POST', body: {}, token });
      await refreshUser?.();
      onChoisie?.(r.address || a);
      onFermer();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setOccupe(false);
    }
  }

  // UNE SUGGESTION SANS NUMÉRO OUVRE UNE SECONDE ÉTAPE, ELLE NE REFUSE PLUS.
  //
  // Beaucoup de suggestions ne portent que la rue (« numéro à compléter ») : la base cartographique
  // connaît la voie sans connaître chaque maison. On répondait « Choisis une adresse avec un
  // numéro », ce qui est une impasse — souvent AUCUNE suggestion n'a de numéro, et le client se
  // retrouvait sans aucun moyen d'enregistrer une adresse pourtant juste.
  // On demande donc le numéro, puis on enregistre.
  //
  // LE NUMÉRO EST VÉRIFIÉ, LUI AUSSI. Le serveur ne se contente pas de reconnaître la rue : il
  // demande le numéro à la base cartographique et refuse « Avenue Louise 99999 », tout en acceptant
  // une rue que personne n'a encore numérotée dans OpenStreetMap — auquel cas refuser punirait le
  // client pour une lacune de la carte. Voir verifierAdressePrecise (backend/geocode.js), qui porte
  // les mesures. Quand le numéro est reconnu, ce sont les coordonnées de LA MAISON qui sont
  // enregistrées, pas le milieu de la voie : c'est ce que le livreur verra sur sa carte.
  // DEPUIS LE 2026-11-08, TOUTE ADRESSE AJOUTÉE PASSE PAR CETTE ÉTAPE : le numéro (prérempli s'il est connu) et son nom,
  // Maison, Travail ou Autre, comme chez Uber Eats. Un toucher de plus, pour ne plus avoir à nommer l'adresse après coup.
  function ajouter(suggestion) {
    if (occupe) return;
    setACompleter(suggestion); setNumero(suggestion.number || ''); setErreur(''); setLibelle(cible || '');
  }

  // UTILISER MA POSITION (fondateur, 2026-11-07 : « quand je cherche une adresse, qu'il prenne juste ma position, je l'ai
  // activée »). Comme la rangée « Position actuelle » d'Uber Eats, sous la recherche. La position PRÉCISE (natif.js ›
  // positionPrecise) : l'approximative d'Android ou d'iPhone tombe à un ou deux kilomètres, ce serait la rue d'un voisin.
  // Le serveur la change en adresse (GET /restaurants/lookup/reverse, celui de l'inscription « Où te livrer ? »), puis on
  // passe par l'étape du numéro, PRÉREMPLI : on voit la rue trouvée et on vérifie la porte avant d'enregistrer — une
  // position prise au salon peut tomber sur la maison d'à côté. L'enregistrement reste celui d'une adresse tapée : le
  // serveur la vérifie et la géocode (POST /auth/me/addresses).
  async function depuisMaPosition() {
    if (occupe || chercheIci) return;
    setChercheIci(true); setErreurIci('');
    try {
      const p = await positionPrecise();
      if (!p) { setErreurIci(t('adresses.hereFailed')); return; }
      // Au-delà de 200 m, c'est la position approximative (ou un GPS qui cherche encore) : pas de quoi trouver une porte.
      if (p.precision > 200) { setErreurIci(t('adresses.hereVague')); return; }
      const r = await api(`/restaurants/lookup/reverse?lat=${p.lat.toFixed(6)}&lng=${p.lng.toFixed(6)}`);
      if (!r?.found) { setErreurIci(t('adresses.hereNotFound')); return; }
      setACompleter({ street: r.street, postalCode: r.postalCode, city: r.city, parPosition: true });
      setNumero(r.number || ''); setErreur(''); setLibelle(cible || '');
    } catch {
      setErreurIci(t('adresses.hereNotFound'));
    } finally {
      setChercheIci(false);
    }
  }

  async function enregistrer(adresse) {
    setOccupe(true);
    try {
      const creee = await api('/auth/me/addresses', {
        method: 'POST', token,
        body: { street: adresse.street, number: adresse.number, postalCode: adresse.postalCode, city: adresse.city, label: libelle }
      });
      // Le serveur retire le nom Maison / Travail à l'adresse qui l'avait (un seul de chaque) : on fait de même ici.
      setAdresses((l) => [...(l || []).filter((x) => x.id !== creee.id).map((x) => (creee.label && x.label === creee.label && LIBELLES_RESERVES.includes(creee.label) ? { ...x, label: '' } : x)), creee]);
      setCible(null);
      setACompleter(null);
      await choisir(creee);
    } catch (e) {
      // Pendant la saisie du numéro, le message reste sous le champ ; ailleurs, le toast fait l'affaire.
      if (aCompleter) setErreur(e.message); else toast(e.message, 'erreur');
      setOccupe(false);
    }
  }

  // Donner (ou retirer, '') le nom Maison / Travail à une adresse déjà enregistrée : PATCH /auth/me/addresses/:id.
  async function nommer(a, label) {
    if (occupe) return;
    setOccupe(true);
    try {
      const maj = await api(`/auth/me/addresses/${a.id}`, { method: 'PATCH', token, body: { label } });
      setAdresses((l) => (l || []).map((x) => (x.id === maj.id ? maj : (label && x.label === label ? { ...x, label: '' } : x))));
      setCible(null);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setOccupe(false);
    }
  }

  async function supprimer(a, e) {
    e.stopPropagation(); // sans ça, supprimer choisirait aussi l'adresse : la rangée entière est un bouton
    try {
      await api(`/auth/me/addresses/${a.id}`, { method: 'DELETE', token });
      setAdresses((l) => (l || []).filter((x) => x.id !== a.id));
    } catch (err) {
      toast(err.message, 'erreur');
    }
  }

  return (
    <SousEcran titre={aCompleter ? t('adresses.numberTitle') : t('adresses.title')} onFermer={aCompleter ? () => setACompleter(null) : onFermer}>
      {/* SECONDE ÉTAPE : le numéro. La rue est acquise, on ne redemande donc qu'une chose, et le
          reste de l'écran disparaît — un champ seul sur un écran vide ne laisse aucun doute sur ce
          qu'on attend. La flèche de l'en-tête revient à la liste plutôt que de tout fermer. */}
      {aCompleter ? (
        <div className="adresse-numero">
          <p className="adresse-numero-rue">
            {aCompleter.street}
            <span className="adresse-sous">{`${aCompleter.postalCode} ${aCompleter.city}`.trim()}</span>
          </p>
          {aCompleter.parPosition && <p className="small adresse-ici-trouvee">{t('adresses.hereFound')}</p>}
          <div className="adresse-noms" role="group" aria-label={t('adresses.nameLabel')}>
            {[['maison', t('adresses.home'), 'maison'], ['travail', t('adresses.work'), 'mallette'], ['', t('adresses.other'), 'position']].map(([cle, nom, icone]) => (
              <button key={cle || 'autre'} type="button" className={`adresse-nom-puce${libelle === cle ? ' on' : ''}`} aria-pressed={libelle === cle} onClick={() => setLibelle(cle)}>
                <Icone nom={icone} taille={16} />{nom}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="adresse-numero-champ">{t('adresses.numberLabel')}</label>
            <input
              id="adresse-numero-champ"
              value={numero}
              onChange={(e) => { setNumero(e.target.value); setErreur(''); }}
              aria-invalid={erreur ? 'true' : undefined}
              aria-describedby={erreur ? 'adresse-numero-erreur' : undefined}
              placeholder={t('adresses.numberPlaceholder')}
              // inputMode et non type=number : un numéro belge peut contenir une lettre ou une barre
              // (« 12A », « 30/2 »), qu'un champ numérique refuserait.
              inputMode="text"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && numero.trim()) enregistrer({ ...aCompleter, number: numero.trim() }); }}
            />
          </div>
          {erreur && <p className="champ-erreur" id="adresse-numero-erreur" role="alert">{erreur}</p>}
          <button
            type="button"
            className="btn-gold"
            style={{ width: '100%', minHeight: 48 }}
            disabled={!numero.trim() || occupe}
            onClick={() => enregistrer({ ...aCompleter, number: numero.trim() })}
          >
            {t('adresses.numberSave')}
          </button>
        </div>
      ) : (
      <>
      <AddressSearch onSelect={ajouter} />
      <div className="adresse-ligne adresse-ici">
        <button type="button" className="adresse-choisir" onClick={depuisMaPosition} disabled={occupe || chercheIci} aria-busy={chercheIci || undefined}>
          <Icone nom="cible" taille={20} />
          <span className="adresse-texte">
            <span className="adresse-nom">{t('adresses.here')}</span>
            {chercheIci && <span className="adresse-sous">{t('adresses.hereLoading')}</span>}
          </span>
        </button>
      </div>
      {erreurIci && <p className="champ-erreur" role="alert">{erreurIci}</p>}
      {/* L'aide de la recherche disait « remplis les champs à la main ci-dessous » alors qu'il n'y en avait pas : une rue
          récente ou absente d'OpenStreetMap laissait le client sans issue (audit du 15/10/2026). */}
      {onSaisieManuelle && (
        <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={onSaisieManuelle}>{t('adresses.typeManually')}</button>
      )}
      {/* MAISON ET TRAVAIL, ÉPINGLÉES EN HAUT (2026-11-08) : posées, on les touche pour y livrer ; pas encore, « Ajouter ».
          « Changer » (ou « Ajouter ») passe le carnet en mode choix : la prochaine adresse ajoutée prend ce nom, ou on touche
          une adresse enregistrée. */}
      {cible && (
        <div className="adresse-cible" role="status">
          <span>{t(cible === 'maison' ? 'adresses.pickHome' : 'adresses.pickWork')}</span>
          <span className="adresse-cible-actions">
            {fixes[cible] && <button type="button" className="btn-ghost btn-sm" onClick={() => nommer(fixes[cible], '')} disabled={occupe}>{t('adresses.unname', { nom: t(cible === 'maison' ? 'adresses.home' : 'adresses.work') })}</button>}
            <button type="button" className="btn-ghost btn-sm" onClick={() => setCible(null)}>{t('adresses.cancel')}</button>
          </span>
        </div>
      )}
      {adresses !== null && !cible && (
        <div className="adresses-fixes">
          {[['maison', t('adresses.home'), 'maison'], ['travail', t('adresses.work'), 'mallette']].map(([cle, nom, icone]) => {
            const a = fixes[cle];
            return (
              <div key={cle} className={`adresse-ligne adresse-fixe${a && enCours(a) ? ' est-active' : ''}`}>
                <button type="button" className="adresse-choisir" onClick={() => (a ? choisir(a) : setCible(cle))} disabled={occupe}>
                  <Icone nom={icone} taille={20} />
                  <span className="adresse-texte">
                    <span className="adresse-nom">{nom}</span>
                    <span className={`adresse-sous${a ? '' : ' adresse-ajouter'}`}>{a ? rueAdresse(a) : t('adresses.add')}</span>
                  </span>
                </button>
                {a && <button type="button" className="adresse-changer" onClick={() => setCible(cle)} aria-label={t('adresses.changeNamed', { nom })}>{t('adresses.change')}</button>}
              </div>
            );
          })}
        </div>
      )}
      <h3 className="adresses-titre">{t(cible ? 'adresses.pickFromSaved' : 'adresses.saved')}</h3>
      {adresses === null && <p className="small">{t('adresses.loading')}</p>}
      {adresses !== null && autres.length === 0 && (
        <p className="small adresses-vide">{t('adresses.empty')}</p>
      )}
      {autres.map((a) => (
        <div key={a.id} className={`adresse-ligne${enCours(a) && !cible ? ' est-active' : ''}`}>
          <button type="button" className="adresse-choisir" onClick={() => (cible ? nommer(a, cible) : choisir(a))} disabled={occupe}>
            <Icone nom={a.label ? 'maison' : 'position'} taille={20} />
            <span className="adresse-texte">
              <span className="adresse-nom">{nomAdresse(a, t) || `${a.street} ${a.number}`.trim()}</span>
              <span className="adresse-sous">
                {a.label ? rueAdresse(a) : `${a.postalCode} ${a.city}`.trim()}
              </span>
            </span>
          </button>
          {/* Supprimer, et non modifier comme chez Uber : une adresse est géocodée à l'enregistrement,
              donc la corriger reviendrait à en créer une autre. Supprimer puis rechercher est plus
              court, et évite une adresse dont les coordonnées ne correspondent plus au texte. */}
          {!cible && (
            <button
              type="button"
              className="adresse-supprimer"
              onClick={(e) => supprimer(a, e)}
              aria-label={t('adresses.remove', { adresse: `${a.street} ${a.number}` })}
              title={t('adresses.removeShort')}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      ))}
      </>
      )}
    </SousEcran>
  );
}
