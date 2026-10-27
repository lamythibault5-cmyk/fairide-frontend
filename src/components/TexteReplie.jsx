import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSiteLarge } from '../hooks/useSiteLarge';
import Modale from './Modale';

/* UNE PHRASE, LE RESTE DERRIÈRE « EN SAVOIR PLUS » (fondateur, 2026-10-27, réponse 10 de maquettes/ecrans-pro/ecrans-pro.html).
 * Les Factures du commerce et du livreur et Ma carte s'ouvraient sur des paragraphes de quatre à six lignes (le bandeau des
 * Factures en avait quatre) : le client, lui, lit une phrase. Sur téléphone (app et site), un texte de plus d'une phrase et
 * de plus de 140 caractères ne montre que sa première phrase, suivie de « En savoir plus » qui ouvre le texte entier dans une
 * feuille (Modale : elle monte du bas, se tire pour fermer). Rien n'est retiré, seulement replié. L'ordinateur montre tout,
 * comme avant. `texte` doit être une chaîne ; `Balise` : la balise d'origine (p, span, div), pour garder la mise en page. */
const PREMIERE_PHRASE = /^([\s\S]+?[.!?…»])\s+(\S[\s\S]*)$/;

export default function TexteReplie({ texte, titre, as: Balise = 'p', className, style }) {
  const { t } = useLanguage();
  const ordinateur = useSiteLarge(900);
  const [ouvert, setOuvert] = useState(false);
  const coupe = typeof texte === 'string' && texte.length > 140 ? texte.match(PREMIERE_PHRASE) : null;
  if (ordinateur || !coupe) return <Balise className={className} style={style}>{texte}</Balise>;
  return (
    <>
      <Balise className={className} style={style}>
        {coupe[1]}{' '}
        <button type="button" className="texte-plus" onClick={(e) => { e.stopPropagation(); setOuvert(true); }}>{t('ecransPro.enSavoirPlus')}</button>
      </Balise>
      {ouvert && (
        <Modale titre={titre || t('ecransPro.enSavoirPlus')} onFermer={() => setOuvert(false)}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{texte}</p>
        </Modale>
      )}
    </>
  );
}
