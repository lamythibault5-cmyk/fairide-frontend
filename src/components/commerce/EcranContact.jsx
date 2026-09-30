import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
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
  const { token } = useAuth();
  const toast = useToast();
  // Patron(s) / responsable(s) (fondateur, 2026-09-30) : les personnes à appeler, distinctes du numéro sur place.
  // Lus à part (GET /:id/managers) : ils ne sont jamais dans la fiche publique.
  const [responsables, setResponsables] = useState(null);
  useEffect(() => {
    let annule = false;
    api(`/restaurants/${restoId}/managers`, { token }).then((r) => { if (!annule) setResponsables(r.managers || []); }).catch(() => { if (!annule) setResponsables([]); });
    return () => { annule = true; };
  }, [restoId, token]);
  const majResponsable = (i, champ, v) => setResponsables((l) => l.map((x, j) => (j === i ? { ...x, [champ]: v } : x)));

  const valider = async () => {
    if (responsables) {
      try {
        await api(`/restaurants/${restoId}/managers`, { method: 'PUT', token, body: { managers: responsables.filter((r) => r.name.trim() || r.phone.trim()) } });
      } catch (e) { toast(e.message, 'erreur'); return; }
    }
    return enregistrerContact();
  };
  const enregistrerContact = () => enregistrer({
    phone: tel.trim(), phoneSecondary: tel2Ouvert ? tel2.trim() : '',
    email: mail.trim(), emailSecondary: mail2Ouvert ? mail2.trim() : '',
    website: site.trim()
  });

  return (
    <SousEcran titre={t('editResto.rowContact')} onFermer={onFermer} pied={<BoutonEnregistrer enCours={enCours} onClick={valider} />}>
      <div className="field">
        <label htmlFor="commerce-tel">{t('editResto.phoneOnSite')}</label>
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
      {responsables && (
        <div className="field" role="group" aria-labelledby="commerce-resp-titre">
          <span className="titre-groupe" id="commerce-resp-titre">{t('editResto.managersTitle')}</span>
          <p className="small" style={{ margin: '0 0 6px' }}>{t('editResto.managersHelp')}</p>
          {responsables.map((r, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input style={{ flex: 1 }} aria-label={t('auth.managerName')} placeholder={t('auth.managerNamePh')} value={r.name} onChange={(e) => majResponsable(i, 'name', e.target.value)} />
                {r.role === 'owner' && <span className="pill">{t('editResto.managerOwner')}</span>}
                <button type="button" className="btn-ghost" style={{ padding: '8px 10px', fontSize: 13 }} onClick={() => setResponsables((l) => l.filter((_, j) => j !== i))}>{t('editResto.removeSecond')}</button>
              </div>
              <div style={{ marginTop: 6 }}><PhoneInput id={`commerce-resp-${i}`} value={r.phone} onChange={(v) => majResponsable(i, 'phone', v)} autoComplete="off" /></div>
            </div>
          ))}
          {responsables.length < 5 && (
            <button type="button" className="btn-link-plus" onClick={() => setResponsables((l) => [...l, { name: '', phone: '', role: 'manager' }])}>＋ {t('auth.addManager')}</button>
          )}
        </div>
      )}
      <div className="field">
        <label htmlFor="commerce-site">{t('editResto.website')}</label>
        <input id="commerce-site" inputMode="url" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://www.mon-commerce.be" />
      </div>
    </SousEcran>
  );
}
