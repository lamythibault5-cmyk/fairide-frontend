import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import usePageMeta from '../../hooks/usePageMeta';
import Icone from '../../components/Icone';
import '../../ecran-demandes.css';

/* LA PREUVE MONTRÉE AU RESTAURANT (« Demande ton restaurant », fondateur, 2026-10-26 ; réponse 7 : nombre, communes et plats,
 * jamais un nom). L'écran qu'Owen ouvre sur son téléphone au comptoir, ou dont il envoie le lien : Admin › Commerces ›
 * Demandes des clients › « Ouvrir la preuve » crée le lien (/preuve/<jeton>), sans compte. Il parle au commerce comme le
 * guide de voix le dit (voix.md) : sa raison, la preuve, puis « Inscrire mon commerce » — le seul lime de l'écran.
 * « On prend 10 %, pas 30 » est permis ici : c'est le discours au commerce, pas un écran client. */
export default function PreuveDemande() {
  const { jeton } = useParams();
  const { t, language } = useLanguage();
  const [p, setP] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  // Écran privé (lien à jeton) : jamais indexé.
  usePageMeta({ title: 'Fairride', description: '', robots: 'noindex, nofollow' });
  useEffect(() => {
    api(`/demandes/preuve/${encodeURIComponent(jeton)}`).then(setP).catch(() => setIntrouvable(true));
  }, [jeton]);

  if (introuvable) {
    return <div className="dm-preuve dm-preuve--vide"><p>{t('demandes.preuveIntrouvable')}</p></div>;
  }
  if (!p) return <div className="dm-preuve" aria-busy="true" />;
  // « le 1er novembre » en français, pas « le 1 novembre ».
  const brute = p.depuis ? new Date(p.depuis).toLocaleDateString(language === 'en' ? 'en-GB' : language === 'nl' ? 'nl-BE' : 'fr-BE', { day: 'numeric', month: 'long' }) : null;
  const date = brute && language === 'fr' ? brute.replace(/^1 /, '1er ') : brute;
  const max = Math.max(1, ...p.communes.map((c) => c.n));
  return (
    <div className="dm-preuve">
      <div className="dm-preuve-corps">
        <p className="dm-preuve-pour"><Icone nom="velo" taille={18} />{t('demandes.preuvePour', { nom: p.nom })}</p>
        <h1>
          <em>{p.total === 1 ? t('demandes.preuveUnePersonne') : t('demandes.preuvePersonnes', { n: p.total })}</em>{' '}
          {p.total === 1 ? t('demandes.preuveVeutUn') : t('demandes.preuveVeulent')}
        </h1>
        <p className="dm-preuve-sous">
          {date && t('demandes.preuveDepuis', { date })}{p.semaine > 0 && <> {t('demandes.preuveSemaine', { n: p.semaine })}</>}
        </p>
        {p.plats.length > 0 && (
          <section className="dm-preuve-carte">
            <h2>{t('demandes.preuvePlats')}</h2>
            <div className="dm-puces">{p.plats.map((x) => <span key={x.plat}>{x.plat}<b>{x.n}</b></span>)}</div>
          </section>
        )}
        {p.communes.length > 0 && (
          <section className="dm-preuve-carte">
            <h2>{t('demandes.preuveCommunes')}</h2>
            {p.communes.map((c) => (
              <div key={c.commune} className="dm-barre"><span>{c.commune}</span><i style={{ width: `${(c.n / max) * 100}%` }} /><b>{c.n}</b></div>
            ))}
          </section>
        )}
        <p className="dm-preuve-garantie">{t('demandes.preuveGarantie')}</p>
        <Link to="/login?audience=partner&role=restaurant" className="btn-gold dm-preuve-bouton">{t('demandes.preuveBouton')}</Link>
        <p className="dm-preuve-petit">{t('demandes.preuvePetit')}</p>
      </div>
    </div>
  );
}
