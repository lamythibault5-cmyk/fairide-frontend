import { useEffect, useRef, useState } from 'react';

// Fait apparaître son contenu (fondu + léger glissement vers le haut) quand il entre dans le viewport
// en scrollant, plutôt que tout afficher d'un bloc dès le chargement — donne un rendu plus vivant à une
// page d'accueil autrement statique. Se déclenche une seule fois par élément (pas de va-et-vient moche
// si l'utilisateur remonte), et ne fait rien du tout si le système demande de réduire les animations.
export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div', style, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal${visible ? ' reveal-visible' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { ...style, transitionDelay: `${delay}ms` } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
