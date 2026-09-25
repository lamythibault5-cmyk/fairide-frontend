import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';
import PhoneInput from '../PhoneInput';
import BoutonEnregistrer from './BoutonEnregistrer';
import useEnregistrerCommerce from './useEnregistrerCommerce';

// Mon commerce › Contact : téléphone, e-mail, site web. Les deuxièmes numéro et e-mail restent repliés
// derrière un « ＋ » tant qu'ils sont vides — la plupart des commerces n'en ont pas.
//
// Les phrases d'aide sous chaque champ sont parties (2026-09-23) : le libellé dit déjà ce qu'on attend
// (« Téléphone du commerce », « E-mail de contact du commerce »), et le serveur refuse un format invalide
// avec un message qui dit lequel.
export default function EcranContact({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const [tel, setTel] = useState(restaurant.phone || '');
  const [tel2, setTel2] = useState(restaurant.phoneSecondary || '');
  const [tel2Ouvert, setTel2Ouvert] = useState(!!restaurant.phoneSecondary);
  const [mail, setMail] = useState(restaurant.email || '');
  const [mail2, setMail2] = useState(restaurant.emailSecondary || '');
  const [mail2Ouvert, setMail2Ouvert] = useState(!!restaurant.emailSecondary);
  const [site, setSite] = useState(restaurant.website || '');
  const { enregistrer, enCours } = useEnregistrerCommerce({ restoId, loadDashboard, onFermer });

  const valider = () => enregistrer({
    phone: tel.trim(), phoneSecondary: tel2Ouvert ? tel2.trim() : '',
    email: mail.trim(), emailSecondary: mail2Ouvert ? mail2.trim() : '',
    website: site.trim()
  });

  return (
    <SousEcran titre={t('editResto.rowContact')} onFermer={onFermer} pied={<BoutonEnregistrer enCours={enCours} onClick={valider} />}>
      <div className="field">
        <label htmlFor="commerce-tel">{t('editResto.phone')}</label>
        <PhoneInput id="commerce-tel" value={tel} onChange={setTel} autoComplete="off" />
      </div>
      {!tel2Ouvert ? (
        <button type="button" className="btn-link-plus" onClick={() => setTel2Ouvert(true)}>＋ {t('editResto.addSecondPhone')}</button>
      ) : (
        <div className="field">
          <label htmlFor="commerce-tel2">{t('editResto.secondPhone')}</label>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}><PhoneInput id="commerce-tel2" value={tel2} onChange={setTel2} autoComplete="off" /></div>
            <button type="button" className="btn-ghost" style={{ padding: '8px 10px', fontSize: 13 }} onClick={() => { setTel2(''); setTel2Ouvert(false); }}>{t('editResto.removeSecond')}</button>
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="commerce-mail">{t('editResto.contactEmail')}</label>
        <input id="commerce-mail" type="email" inputMode="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="contact@mon-commerce.be" />
      </div>
      {!mail2Ouvert ? (
        <button type="button" className="btn-link-plus" onClick={() => setMail2Ouvert(true)}>＋ {t('editResto.addSecondEmail')}</button>
      ) : (
        <div className="field">
          <label htmlFor="commerce-mail2">{t('editResto.secondEmail')}</label>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input id="commerce-mail2" type="email" inputMode="email" style={{ flex: 1 }} value={mail2} onChange={(e) => setMail2(e.target.value)} placeholder="commandes@mon-commerce.be" />
            <button type="button" className="btn-ghost" style={{ padding: '8px 10px', fontSize: 13 }} onClick={() => { setMail2(''); setMail2Ouvert(false); }}>{t('editResto.removeSecond')}</button>
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="commerce-site">{t('editResto.website')}</label>
        <input id="commerce-site" inputMode="url" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://www.mon-commerce.be" />
      </div>
    </SousEcran>
  );
}
