import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

// Liste déroulante des administrateurs (GET /admin/admins → [{ email, name }]) pour « assigné à » et
// « responsable » : tickets, tâches, prospects CRM, actions groupées. Une seule requête par session,
// partagée entre tous les composants. Si la liste ne peut pas être chargée (ancien serveur), on
// retombe sur un champ e-mail libre : rien ne bloque.
let cacheAdmins = null;
let enCours = null;

export function useAdmins() {
  const { token } = useAuth();
  const [admins, setAdmins] = useState(cacheAdmins);
  useEffect(() => {
    if (cacheAdmins || !token) return undefined;
    let actif = true;
    enCours = enCours || api('/admin/admins', { token }).then((l) => { cacheAdmins = Array.isArray(l) ? l : []; return cacheAdmins; }).catch(() => { cacheAdmins = []; return cacheAdmins; }).finally(() => { enCours = null; });
    enCours.then((l) => { if (actif) setAdmins(l); });
    return () => { actif = false; };
  }, [token]);
  return admins;
}

export default function AssigneeSelect({ value, onChange, allowEmpty = true, emptyLabel, style, id, autoFocus }) {
  const { t: tr } = useLanguage();
  const { user } = useAuth();
  const admins = useAdmins();
  const liste = admins && admins.length ? admins : null;
  // Valeur courante absente de la liste (ancien e-mail) : on l'ajoute pour ne pas la perdre à l'affichage.
  const options = liste ? [...liste] : [];
  if (liste && value && !liste.some((a) => a.email === value)) options.push({ email: value, name: value });
  if (!liste) {
    return <input id={id} type="email" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={user?.email || 'email@fairide.be'} style={style} autoFocus={autoFocus} />;
  }
  return (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} style={style} autoFocus={autoFocus}>
      {allowEmpty && <option value="">{emptyLabel || tr('adminCommon.unassigned')}</option>}
      {options.map((a) => <option key={a.email} value={a.email}>{a.name && a.name !== a.email ? `${a.name} (${a.email})` : a.email}{user?.email === a.email ? ` — ${tr('adminCommon.me')}` : ''}</option>)}
    </select>
  );
}
