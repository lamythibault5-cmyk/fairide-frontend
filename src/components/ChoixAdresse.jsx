import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import SousEcran from './SousEcran';
import AddressSearch from './AddressSearch';
import Icone from './Icone';

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
export default function ChoixAdresse({ onFermer, onChoisie }) {
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
  function ajouter(suggestion) {
    if (occupe) return;
    if (!suggestion.number) { setACompleter(suggestion); setNumero(''); setErreur(''); return; }
    enregistrer(suggestion);
  }

  async function enregistrer(adresse) {
    setOccupe(true);
    try {
      const creee = await api('/auth/me/addresses', {
        method: 'POST', token,
        body: { street: adresse.street, number: adresse.number, postalCode: adresse.postalCode, city: adresse.city }
      });
      setAdresses((l) => [...(l || []).filter((x) => x.id !== creee.id), creee]);
      setACompleter(null);
      await choisir(creee);
    } catch (e) {
      // Pendant la saisie du numéro, le message reste sous le champ ; ailleurs, le toast fait l'affaire.
      if (aCompleter) setErreur(e.message); else toast(e.message, 'erreur');
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
      <h3 className="adresses-titre">{t('adresses.saved')}</h3>
      {adresses === null && <p className="small">{t('adresses.loading')}</p>}
      {adresses !== null && adresses.length === 0 && (
        <p className="small adresses-vide">{t('adresses.empty')}</p>
      )}
      {(adresses || []).map((a) => (
        <div key={a.id} className={`adresse-ligne${enCours(a) ? ' est-active' : ''}`}>
          <button type="button" className="adresse-choisir" onClick={() => choisir(a)} disabled={occupe}>
            <Icone nom={a.label ? 'maison' : 'position'} taille={20} />
            <span className="adresse-texte">
              <span className="adresse-nom">{a.label || `${a.street} ${a.number}`.trim()}</span>
              <span className="adresse-sous">
                {a.label ? `${a.street} ${a.number}, ${a.city}`.replace(' ,', ',') : `${a.postalCode} ${a.city}`.trim()}
              </span>
            </span>
          </button>
          {/* Supprimer, et non modifier comme chez Uber : une adresse est géocodée à l'enregistrement,
              donc la corriger reviendrait à en créer une autre. Supprimer puis rechercher est plus
              court, et évite une adresse dont les coordonnées ne correspondent plus au texte. */}
          <button
            type="button"
            className="adresse-supprimer"
            onClick={(e) => supprimer(a, e)}
            aria-label={t('adresses.remove', { adresse: `${a.street} ${a.number}` })}
            title={t('adresses.removeShort')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
      </>
      )}
    </SousEcran>
  );
}
