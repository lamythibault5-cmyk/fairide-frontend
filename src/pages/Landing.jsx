import { useNavigate, Link } from 'react-router-dom';
import { COMMUNES } from '../menuCategories';

const JOIN_CARDS = [
  {
    key: 'client',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&q=80',
    title: 'Commande chez les commerces de ton quartier',
    link: '🛍️ Commander maintenant',
    to: '/login?audience=client'
  },
  {
    key: 'restaurant',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=700&q=80',
    title: 'Vends tes plats sans te faire dévorer par les commissions',
    link: '🏪 Ajouter mon commerce',
    to: '/login?audience=partner&role=restaurant'
  },
  {
    key: 'driver',
    image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=700&q=80',
    title: 'Roule et sois payé plus justement à chaque course',
    link: '🛵 Devenir livreur',
    to: '/login?audience=partner&role=driver'
  }
];

const FEATURES = [
  {
    icon: '🏪',
    title: '100% commerces locaux',
    text: "Restaurants, supermarchés, night shops, boulangeries... découvre et soutiens les commerces de ton quartier, accessibles à tous."
  },
  {
    icon: '🚲',
    title: 'Livraison agile en deux-roues',
    text: 'Vélo, vélo électrique ou deux-roues motorisé : nos livreurs se faufilent partout dans Bruxelles, bien plus agiles qu\'une voiture. Moins de bouchons, moins de place perdue en ville, une livraison qui a du sens.'
  },
  {
    icon: '🤝',
    title: 'Juste pour tout le monde',
    text: "6% de commission au lieu des 25-30% des grandes plateformes : les restaurants gardent plus, et les livreurs sont mieux payés pour chaque course."
  }
];

const STEPS = [
  { num: '1', title: 'Choisis ton commerce', text: 'Parcours les restaurants et commerces locaux près de chez toi.' },
  { num: '2', title: 'Commande & paie', text: 'Paiement sécurisé, commande transmise instantanément.' },
  { num: '3', title: 'Reçois ta livraison', text: 'Suis ta commande en temps réel jusqu\'à ta porte.' }
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="decor-page">
      <div className="decor-blob teal" style={{ width: 380, height: 380, top: -140, left: -160 }} />
      <div className="decor-blob gold" style={{ width: 300, height: 300, top: 260, right: -120 }} />
      <div className="decor-blob teal" style={{ width: 260, height: 260, bottom: -60, left: '35%' }} />

      <div className="landing-hero">
        <span className="pill hero" style={{ marginBottom: 14 }}>📍 Local d'abord</span>
        <h1 className="landing-title">
          Les commerces de ton quartier,<br />livrés chez toi.
        </h1>
        <p className="landing-sub">
          Fairide connecte restaurants, supermarchés et commerces locaux à des livreurs justement rémunérés —
          sans la commission excessive des grandes plateformes. Paie ta commande, pas la plateforme.
        </p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-gold" onClick={() => navigate('/login?audience=client')}>🛍️ Commander maintenant</button>
          <button className="btn-teal" onClick={() => navigate('/login?audience=partner')}>🏪 Devenir partenaire</button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stats-bar-item"><b>6%</b><span>de commission (vs 25-30% ailleurs)</span></div>
        <div className="stats-bar-item"><b>19</b><span>communes bruxelloises couvertes</span></div>
        <div className="stats-bar-item"><b>100%</b><span>commerces et livreurs locaux</span></div>
      </div>

      <div className="feature-grid">
        {FEATURES.map((f) => (
          <div className="card feature-card" key={f.title}>
            <div className="feature-icon">{f.icon}</div>
            <h3 style={{ fontSize: 17, margin: '10px 0 6px' }}>{f.title}</h3>
            <p className="small" style={{ lineHeight: 1.5 }}>{f.text}</p>
          </div>
        ))}
      </div>

      <h2 className="section-title" style={{ textAlign: 'center' }}>Comment ça marche</h2>
      <div className="steps-grid">
        {STEPS.map((s) => (
          <div key={s.num} className="step-card">
            <div className="step-num">{s.num}</div>
            <h3 style={{ fontSize: 15, margin: '8px 0 4px' }}>{s.title}</h3>
            <p className="small">{s.text}</p>
          </div>
        ))}
      </div>

      <h2 className="section-title" style={{ textAlign: 'center' }}>Rejoindre Fairide</h2>
      <div className="join-grid">
        {JOIN_CARDS.map((c) => (
          <Link key={c.key} to={c.to} className="join-card" style={{ backgroundImage: `url('${c.image}')` }}>
            <h3>{c.title}</h3>
            <span className="join-link">{c.link}</span>
          </Link>
        ))}
      </div>

      <h2 className="section-title" style={{ textAlign: 'center' }}>Communes desservies à Bruxelles</h2>
      <div className="commune-pills">
        {COMMUNES.map((c) => <span key={c} className="pill teal">{c}</span>)}
      </div>

      <div className="card" style={{ textAlign: 'center', background: 'var(--ink)', color: 'var(--cream)', border: 'none' }}>
        <h2 style={{ color: 'var(--cream)', marginBottom: 8 }}>Prêt à soutenir ton quartier ?</h2>
        <p className="small" style={{ color: 'var(--cream)', opacity: 0.85, marginBottom: 16 }}>
          Rejoins Fairide comme client, commerce ou livreur — c'est gratuit à l'inscription.
        </p>
        <button className="btn-gold" onClick={() => navigate('/login')}>Créer mon compte</button>
      </div>
    </div>
  );
}
