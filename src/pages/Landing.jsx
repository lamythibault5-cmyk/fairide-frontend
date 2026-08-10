import { useNavigate } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🥗',
    title: 'Sain & savoureux',
    text: "Des plats frais, préparés par de vrais restaurants du quartier — pas de la malbouffe industrielle. Filtre par cuisine et découvre des options équilibrées près de chez toi."
  },
  {
    icon: '🚲',
    title: 'Livraison éco-responsable',
    text: 'Nos livreurs se déplacent à vélo ou en scooter électrique. Moins de circulation, moins d\'émissions, une livraison qui a du sens.'
  },
  {
    icon: '🤝',
    title: 'Commission réduite',
    text: "6% de commission au lieu des 25-30% des grandes plateformes. Les restaurants gardent plus, les prix restent justes."
  }
];

const STEPS = [
  { num: '1', title: 'Choisis ton resto', text: 'Parcours les restaurants locaux et leurs plats du jour.' },
  { num: '2', title: 'Commande & paie', text: 'Paiement sécurisé, commande transmise instantanément.' },
  { num: '3', title: 'Reçois ta livraison', text: 'Suis ta commande en temps réel jusqu\'à ta porte.' }
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="landing-hero">
        <span className="pill teal" style={{ marginBottom: 14 }}>🌱 Manger bien, livrer mieux</span>
        <h1 className="landing-title">
          Des repas sains qui donnent envie,<br />livrés de façon éco-responsable.
        </h1>
        <p className="landing-sub">
          Fairide connecte les restaurants locaux, les livreurs et toi — sans prendre une commission excessive au passage.
          Paie le repas, pas la plateforme.
        </p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-gold" onClick={() => navigate('/login')}>🧑‍🍳 Commander maintenant</button>
          <button className="btn-outline" onClick={() => navigate('/login')}>🍽️ Devenir partenaire</button>
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
        <h2 style={{ color: 'var(--cream)', marginBottom: 8 }}>Prêt à goûter la différence ?</h2>
        <p className="small" style={{ color: 'var(--cream)', opacity: 0.85, marginBottom: 16 }}>
          Rejoins Fairide comme client, restaurant ou livreur — c'est gratuit à l'inscription.
        </p>
        <button className="btn-gold" onClick={() => navigate('/login')}>Créer mon compte</button>
      </div>
    </div>
  );
}
