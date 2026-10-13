import { useState } from 'react';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { money } from '../adminUtils';
import { useApiData, LoadState } from './common';

/* Compteur du seuil de la franchise TVA (lettre du SPF Finances du 12 octobre 2026 : Fairide SRL relève du régime particulier
 * de franchise des petites entreprises depuis le 7 septembre 2026). La franchise tient tant que le chiffre d'affaires de
 * Fairide reste sous 25 000 € HTVA par an ; depuis 2025, elle prend fin DÈS l'opération qui fait dépasser le seuil. Le
 * serveur (GET /admin/accounting/franchise, seuilFranchise.js) compte les revenus de Fairide seulement — commission, marge
 * vélo, frais de système, abonnements, mises en avant — et proratise le seuil l'année du début (lecture prudente, à faire
 * confirmer par le comptable). Ici, on le montre : où on en est, et ce qu'il faut faire au-delà. */
const COMPTES = ['700-COMM', '701-LIVR', '702-SERV', '703-ABO', '704-MEA'];
const COULEUR = { ok: 'var(--iris)', attention: 'var(--orange)', urgent: 'var(--red)', depasse: 'var(--red)' };

export default function FranchiseTva({ token }) {
  const { t: tr } = useLanguage();
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const etat = useApiData(() => api(`/admin/accounting/franchise?year=${annee}`, { token }), [annee]);

  return (
    <LoadState state={etat} skeleton={1}>
      {(d) => (d.franchise ? (
        <div className="card" style={{ borderLeft: `3px solid ${COULEUR[d.level] || 'var(--iris)'}` }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{tr('adminAccounting.franchiseTitle')}</h3>
            <label htmlFor="franchise-annee" className="small">{tr('adminAccounting.listingYear')}{' '}
              <select id="franchise-annee" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={{ width: 'auto' }}>
                {[0, 1].map((i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <p className="small" style={{ margin: '6px 0 10px' }}>{tr('adminAccounting.franchiseIntro', { since: new Date(d.franchiseSince).toLocaleDateString() })}</p>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{money(d.turnover)} <span className="small" style={{ fontWeight: 400 }}>/ {money(d.threshold)}</span></div>
          <div role="meter" aria-valuemin={0} aria-valuemax={d.threshold} aria-valuenow={d.turnover} aria-label={tr('adminAccounting.franchiseTitle')}
            style={{ height: 8, border: '1px solid var(--line)', borderRadius: 4, margin: '8px 0', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, d.share * 100)}%`, height: '100%', background: COULEUR[d.level] || 'var(--iris)' }} />
          </div>
          <p className="small" style={{ margin: '0 0 8px' }}>
            {tr(`adminAccounting.franchiseLevel_${d.level}`, { pct: Math.round(d.share * 100), remaining: money(d.remaining) })}
            {d.prorated && <> {tr('adminAccounting.franchiseProrated', { annual: money(d.annualThreshold) })}</>}
          </p>
          <div className="small" style={{ opacity: 0.75 }}>
            {COMPTES.map((c) => <div key={c} className="row" style={{ justifyContent: 'space-between' }}><span>{tr(`adminAccounting.franchiseAccount_${c.replace('-', '_')}`)}</span><span>{money(d.byAccount?.[c] || 0)}</span></div>)}
          </div>
        </div>
      ) : null)}
    </LoadState>
  );
}
