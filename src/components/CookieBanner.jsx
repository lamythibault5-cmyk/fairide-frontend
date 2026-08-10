import { useEffect, useState } from 'react';

const STORAGE_KEY = 'fairide_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', color: 'var(--cream)',
      padding: '14px 18px', zIndex: 200, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center'
    }}>
      <span className="small" style={{ color: 'var(--cream)' }}>
        Fairide utilise uniquement des cookies techniques nécessaires au fonctionnement du site (connexion, panier). Aucun tracking publicitaire.
      </span>
      <button className="btn-gold" style={{ padding: '8px 18px', fontSize: 13 }} onClick={accept}>J'ai compris</button>
    </div>
  );
}
