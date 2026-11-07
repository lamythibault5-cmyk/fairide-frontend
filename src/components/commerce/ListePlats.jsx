import { useLanguage } from '../../context/LanguageContext';

// Les plats : la quantité en iris, les choix à la suite, la note du client mise en évidence (elle part aussi au ticket).
// `epuises` (une commande encore à accepter ; pré-GO 2026-11-06, G168) : un plat marqué épuisé sur la carte depuis que le
// client a ouvert sa page de paiement porte « Épuisé sur ta carte », pour que le commerce le voie avant d'accepter.
export default function ListePlats({ items, epuises = false }) {
  const { t } = useLanguage();
  return (
    <ul className="ec-cmd-items">
      {(items || []).map((i, k) => (
        <li key={k}>
          <b>{i.qty}×</b>
          <span>{i.name}{i.options?.length > 0 && <small> · {i.options.map((x) => x.name).join(', ')}</small>}{i.note && <> <em>« {i.note} »</em></>}{epuises && i.outOfStockNow && <> <strong style={{ color: 'var(--red)' }}>{t('ordersResto.outOfStockNow')}</strong></>}</span>
        </li>
      ))}
    </ul>
  );
}
