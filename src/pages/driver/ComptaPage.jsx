import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiDownload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import ErreurChargement from '../../components/ErreurChargement';
import Icone from '../../components/Icone';
import SousEcran from '../../components/SousEcran';
import PageLivreur from '../../components/livreur/PageLivreur';
import { euros, eurosCourt } from '../../prixPlat';

/* « MA COMPTA » DU LIVREUR (Owen, 12/11/2026 : « tout ce qui est possible pour nous à faire et qui nous freine pas » ; « très
 * basique, pas trop de boutons, un bouton clair en lime »). Les livreurs demandaient si Fairride les aide pour la TVA et les
 * impôts. Fairride ne calcule ni impôt ni cotisation (conseil fiscal), mais leur donne leurs propres chiffres, prêts à recopier
 * (serveur comptaLivreur.js, GET /couriers/me/compta) :
 *   - en franchise, le compteur du plafond de la franchise TVA (son chiffre d'affaires sur Fairride, pas ailleurs) ;
 *   - par trimestre : courses, ventes, pourboires, et pour un assujetti la TVA comprise et le montant hors TVA ;
 *   - LE bouton lime : le récap annuel en PDF, aux chiffres que Fairride déclare au SPF Finances (DAC7) ;
 *   - trois rangées : l'export de toutes ses courses (CSV, pour le comptable), ses relevés mensuels, et « Ta compta en
 *     5 minutes » (ce qu'il doit faire et quand, sans conseil chiffré).
 * Rien n'est comparé à d'autres livreurs, rien n'est noté. */
export default function ComptaPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [annee, setAnnee] = useState(null);
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(null); // 'pdf' | 'csv'
  const [guide, setGuide] = useState(false);

  const charger = useCallback(() => {
    setErreur(null);
    // Un serveur qui ne connaît pas encore « Ma compta » (front publié avant le backend) répond sans `totaux` : erreur de
    // chargement avec « Réessayer », jamais une page plantée.
    api(`/couriers/me/compta${annee ? `?year=${annee}` : ''}`, { token })
      .then((r) => (r?.totaux && Array.isArray(r.trimestres) ? setDonnees(r) : setErreur(new Error(t('comptaLivreur.vide')))))
      .catch(setErreur);
  }, [token, annee, t]);
  useEffect(() => { charger(); }, [charger]);

  async function telecharger(quoi) {
    const an = donnees.annee;
    setOccupe(quoi);
    try {
      if (quoi === 'pdf') await apiDownload(`/couriers/me/compta/${an}/recap.pdf`, { token, filename: `fairride-recap-${an}.pdf` });
      else await apiDownload(`/couriers/me/compta/${an}/courses.csv`, { token, filename: `fairride-courses-${an}.csv` });
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }

  const d = donnees;
  const rien = d && d.totaux.total === 0 && d.totaux.courses === 0;
  return (
    <PageLivreur classe="ecl-compta" bandeauApp retourCompte titre={t('comptaLivreur.titre')} sous={t('comptaLivreur.sous')}>
      {!d && erreur ? <ErreurChargement erreur={erreur} onReessayer={charger} /> : !d ? <SkeletonCards count={3} /> : (
        <>
          {d.annees?.length > 1 && (
            <div className="ecl-compta-annees" role="group" aria-label={t('comptaLivreur.annee')}>
              {d.annees.map((a) => (
                <button key={a} type="button" className={`ecl-compta-annee${a === d.annee ? ' actif' : ''}`} aria-pressed={a === d.annee} onClick={() => setAnnee(a)}>{a}</button>
              ))}
            </div>
          )}

          {/* La franchise TVA : seulement pour qui y est. Un assujetti n'a pas de plafond à surveiller. */}
          {!d.assujetti && (
            <section className="ecl-compta-franchise">
              <h2 className="ecl-titre-sec">{t('comptaLivreur.franchiseTitre')}</h2>
              <p className="ecl-compta-chiffre">{t('comptaLivreur.franchiseLigne', { chiffre: euros(d.franchise.chiffre), plafond: eurosCourt(d.franchise.plafond) })}</p>
              <div className="ecl-compta-jauge" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(d.franchise.part * 100)}>
                <span style={{ width: `${Math.max(1, Math.round(d.franchise.part * 100))}%` }} />
              </div>
              <p className="small">{d.franchise.part >= 0.8 ? t('comptaLivreur.franchiseProche') : t('comptaLivreur.franchiseReste', { reste: euros(d.franchise.reste) })}</p>
            </section>
          )}

          <h2 className="ecl-titre-sec">{t('comptaLivreur.anneeTitre', { annee: d.annee })}</h2>
          {rien ? <p className="small">{t('comptaLivreur.vide')}</p> : (
            <ul className="ecl-etapes">
              {d.trimestres.filter((q) => q.total !== 0 || q.courses > 0).map((q) => (
                <li key={q.trimestre} className="ecl-etape ecl-compta-trimestre">
                  <span className="ecl-grow">
                    <b>{t('comptaLivreur.trimestre', { n: q.trimestre })}</b>
                    <small>
                      {[t('comptaLivreur.courses', { n: q.courses }), `${t('comptaLivreur.ventes')} ${euros(q.ventes)}`, q.pourboires ? `${t('comptaLivreur.pourboires')} ${euros(q.pourboires)}` : null].filter(Boolean).join(' · ')}
                    </small>
                    {d.assujetti && <small>{t('comptaLivreur.dontTva', { tva: euros(q.tva), ht: euros(q.baseHt) })}</small>}
                  </span>
                  <b className="ecl-compta-montant">{euros(q.total)}</b>
                </li>
              ))}
              <li className="ecl-etape ecl-compta-trimestre">
                <span className="ecl-grow"><b>{t('comptaLivreur.totalAnnee')}</b>{d.assujetti && <small>{t('comptaLivreur.dontTva', { tva: euros(d.totaux.tva), ht: euros(d.totaux.baseHt) })}</small>}</span>
                <b className="ecl-compta-montant">{euros(d.totaux.total)}</b>
              </li>
            </ul>
          )}

          {/* L'action de l'écran : le récap annuel. Une seule touche lime. */}
          <button type="button" className="btn-gold ecl-bouton-dossier" disabled={occupe === 'pdf'} onClick={() => telecharger('pdf')}>
            {occupe === 'pdf' ? '…' : t('comptaLivreur.telecharger', { annee: d.annee })}
          </button>
          <p className="small ecl-compta-note">{t('comptaLivreur.dac7Note')}</p>

          <ul className="ecl-etapes">
            <li>
              <button type="button" className="ecl-etape" disabled={occupe === 'csv'} onClick={() => telecharger('csv')}>
                <span className="ecl-grow"><b>{t('comptaLivreur.csv')}</b><small>{t('comptaLivreur.csvSous')}</small></span>
                <Icone nom="retour" taille={16} className="bv-chevron" />
              </button>
            </li>
            <li>
              <Link to="/driver/invoices" className="ecl-etape">
                <span className="ecl-grow"><b>{t('comptaLivreur.releves')}</b><small>{t('comptaLivreur.relevesSous')}</small></span>
                <Icone nom="retour" taille={16} className="bv-chevron" />
              </Link>
            </li>
            <li>
              <button type="button" className="ecl-etape" onClick={() => setGuide(true)}>
                <span className="ecl-grow"><b>{t('comptaLivreur.guide')}</b><small>{t('comptaLivreur.guideSous')}</small></span>
                <Icone nom="retour" taille={16} className="bv-chevron" />
              </button>
            </li>
          </ul>
        </>
      )}

      {guide && (
        <SousEcran titre={t('comptaLivreur.guide')} onFermer={() => setGuide(false)}>
          <div className="ecl-compta-guide">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <section key={n}>
                <h3>{t(`comptaLivreur.g${n}T`)}</h3>
                <p>{t(`comptaLivreur.g${n}`, { plafond: eurosCourt(d?.franchise?.plafond ?? 25000) })}</p>
              </section>
            ))}
            <p className="small">{t('comptaLivreur.guideFin')}</p>
          </div>
        </SousEcran>
      )}
    </PageLivreur>
  );
}
