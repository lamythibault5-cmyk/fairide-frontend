// Les plats : la quantité en iris, les choix à la suite, la note du client mise en évidence (elle part aussi au ticket).
export default function ListePlats({ items }) {
  return (
    <ul className="ec-cmd-items">
      {(items || []).map((i, k) => (
        <li key={k}>
          <b>{i.qty}×</b>
          <span>{i.name}{i.options?.length > 0 && <small> · {i.options.map((x) => x.name).join(', ')}</small>}{i.note && <> <em>« {i.note} »</em></>}</span>
        </li>
      ))}
    </ul>
  );
}
