import { useNavigate, Link } from 'react-router-dom';
import { COMMUNES } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';
import ContactSection from '../components/ContactSection';
import PartnersMarquee from '../components/PartnersMarquee';

function joinCards(t) {
  return [
    {
      key: 'client',
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&q=80',
      title: t('landing.joinClientTitle'),
      link: t('landing.joinClientLink'),
      to: '/login?audience=client'
    },
    {
      key: 'restaurant',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=700&q=80',
      title: t('landing.joinRestaurantTitle'),
      link: t('landing.joinRestaurantLink'),
      to: '/login?audience=partner&role=restaurant'
    },
    {
      key: 'driver',
      image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=700&q=80',
      title: t('landing.joinDriverTitle'),
      link: t('landing.joinDriverLink'),
      to: '/login?audience=partner&role=driver'
    }
  ];
}

function features(t) {
  return [
    { icon: '🏪', title: t('landing.featureLocalTitle'), text: t('landing.featureLocalText') },
    { icon: '🚲', title: t('landing.featureBikeTitle'), text: t('landing.featureBikeText') },
    { icon: '🤝', title: t('landing.featureFairTitle'), text: t('landing.featureFairText') }
  ];
}

function steps(t) {
  return [
    { num: '1', title: t('landing.step1Title'), text: t('landing.step1Text') },
    { num: '2', title: t('landing.step2Title'), text: t('landing.step2Text') },
    { num: '3', title: t('landing.step3Title'), text: t('landing.step3Text') }
  ];
}

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="decor-page">
      <div className="decor-blob teal" style={{ width: 380, height: 380, top: -140, left: -160 }} />
      <div className="decor-blob gold" style={{ width: 300, height: 300, top: 260, right: -120 }} />
      <div className="decor-blob teal" style={{ width: 260, height: 260, bottom: -60, left: '35%' }} />

      <div className="landing-hero">
        <div className="be-flag" title="Fièrement belge">
          <span className="be-flag-stripe" style={{ background: '#000' }} />
          <span className="be-flag-stripe" style={{ background: '#FAE042' }} />
          <span className="be-flag-stripe" style={{ background: '#ED2939' }} />
        </div>
        <span className="pill hero" style={{ marginBottom: 14 }}>{t('landing.pill')}</span>
        <h1 className="landing-title">
          {t('landing.title1')}<br />{t('landing.title2')}
        </h1>
        <p className="landing-sub">
          {t('landing.sub')}
        </p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-gold" onClick={() => navigate('/login?audience=client')}>{t('landing.orderNow')}</button>
          <button className="btn-teal" onClick={() => navigate('/login?audience=partner')}>{t('landing.becomePartner')}</button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stats-bar-item"><b>10%</b><span>{t('landing.statCommission')}</span></div>
        <div className="stats-bar-item"><b>19</b><span>{t('landing.statCommunes')}</span></div>
        <div className="stats-bar-item"><b>100%</b><span>{t('landing.statLocal')}</span></div>
      </div>

      <div className="feature-grid">
        {features(t).map((f) => (
          <div className="card feature-card" key={f.title}>
            <div className="feature-icon">{f.icon}</div>
            <h3 style={{ fontSize: 17, margin: '10px 0 6px' }}>{f.title}</h3>
            <p className="small" style={{ lineHeight: 1.5 }}>{f.text}</p>
          </div>
        ))}
      </div>

      <h2 className="section-title" style={{ textAlign: 'center' }}>{t('landing.howItWorks')}</h2>
      <div className="steps-grid">
        {steps(t).map((s) => (
          <div key={s.num} className="step-card">
            <div className="step-num">{s.num}</div>
            <h3 style={{ fontSize: 15, margin: '8px 0 4px' }}>{s.title}</h3>
            <p className="small">{s.text}</p>
          </div>
        ))}
      </div>

      <h2 className="section-title" style={{ textAlign: 'center' }}>{t('landing.joinTitle')}</h2>
      <div className="join-grid">
        {joinCards(t).map((c) => (
          <Link key={c.key} to={c.to} className="join-card" style={{ backgroundImage: `url('${c.image}')` }}>
            <h3>{c.title}</h3>
            <span className="join-link">{c.link}</span>
          </Link>
        ))}
      </div>

      <h2 className="section-title" style={{ textAlign: 'center' }}>{t('landing.communesTitle')}</h2>
      <div className="commune-pills">
        {COMMUNES.map((c) => <span key={c} className="pill teal">{c}</span>)}
      </div>

      <h2 className="section-title" style={{ textAlign: 'center' }}>{t('landing.contactTitle')}</h2>
      <ContactSection />

      <PartnersMarquee />

      <div className="card" style={{ textAlign: 'center', background: 'var(--ink)', color: 'var(--cream)', border: 'none' }}>
        <h2 style={{ color: 'var(--cream)', marginBottom: 8 }}>{t('landing.ctaTitle')}</h2>
        <p className="small" style={{ color: 'var(--cream)', opacity: 0.85, marginBottom: 16 }}>
          {t('landing.ctaText')}
        </p>
        <button className="btn-gold" onClick={() => navigate('/login')}>{t('landing.ctaButton')}</button>
      </div>
    </div>
  );
}
