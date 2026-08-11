import { useNavigate } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🏪',
    title: '100% commerces locaux',
    text: "Restaurants, supermarchés, night shops, boulangeries... découvre et soutiens les commerces de ton quartier, pas des chaînes anonymes."
  },
  {
    icon: '🚲',
    title: 'Livraison éco-responsable',
    text: 'Nos livreurs se déplacent à vélo ou en scooter électrique. Moins de circulation, moins d\'émissions, une livraison qui a du sens.'
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
    <div>
      <div className="landing-hero">
        <span className="pill hero" style={{ marginBottom: 14 }}>📍 Local d'abord</span>
        <h1 className="landing-title">
          Les commerces de ton quartier,<br />livrés par des gens d'ici.
        </h1>
        <p className="landing-sub">
          Fairide connecte restaurants, supermarchés et commerces locaux à des livreurs justement rémunérés —
          sans la commission excessive des grandes plateformes. Paie ta commande, pas la plateforme.
        </p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-gold" onClick={() => navigate('/login')}>🛍️ Commander maintenant</button>
          <button className="btn-outline" onClick={() => navigate('/login')}>🏪 Devenir partenaire</button>
        </div>
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
