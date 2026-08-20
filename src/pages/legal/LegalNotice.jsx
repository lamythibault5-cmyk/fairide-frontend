import usePageMeta from '../../hooks/usePageMeta';

export default function LegalNotice() {
  usePageMeta({ title: 'Mentions légales — Fairide', path: '/mentions-legales' });
  return (
    <div className="card">
      <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
        ⚠️ Document de travail — à faire relire et compléter par un professionnel (avocat/comptable) avant publication réelle. Les champs entre [crochets] doivent être remplis.
      </div>
      <h2 style={{ marginTop: 0 }}>Mentions légales</h2>
      <h3>Éditeur du site</h3>
      <p className="small">
        Fairide<br />
        [Forme juridique — ex: personne physique / SRL en formation]<br />
        [Numéro d'entreprise BCE]<br />
        Siège : [Adresse complète, Belgique]<br />
        Email : contact@fairide.be
      </p>
      <h3>Hébergement</h3>
      <p className="small">
        Frontend hébergé par Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA).<br />
        Backend et base de données hébergés par Railway Corporation.
      </p>
      <h3>Propriété intellectuelle</h3>
      <p className="small">
        L'ensemble des contenus du site Fairide (textes, logo, mise en page) est protégé. Toute reproduction sans autorisation est interdite,
        sauf les contenus fournis par les restaurants et commerces partenaires (photos, descriptions) qui restent leur propriété.
      </p>
      <h3>Responsabilité</h3>
      <p className="small">
        Fairide agit en tant qu'intermédiaire technique entre clients, commerces partenaires et livreurs indépendants.
        Fairide ne prépare ni ne livre elle-même les commandes et ne saurait être tenue responsable de la qualité des produits
        ou du respect des délais par les commerces et livreurs partenaires.
      </p>
    </div>
  );
}
