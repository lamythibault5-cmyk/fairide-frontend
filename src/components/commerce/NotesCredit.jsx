import { useEffect, useState } from 'react';
import { api, apiDownload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';

/* LES NOTES DE CRÉDIT DU COMMERCE (audit du 19/10, shop-106). Une commande remboursée en entier après l'émission de sa
 * facture reçoit une note de crédit numérotée, et l'équipe peut créditer une facture entière : ces pièces comptables
 * existaient côté serveur, mais le commerce ne les voyait nulle part — son comptable gardait une facture qui comptait trop
 * de commission. Elles sont aussi envoyées par e-mail (invoiceDelivery.envoyerNoteCredit). Le bloc n'apparaît que s'il y en
 * a : la plupart des commerces n'en auront jamais. Un tableau séparé de InvoiceArchive, partagé avec le livreur, qui
 * n'en a pas. */
export default function NotesCredit() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [occupe, setOccupe] = useState(null);

  useEffect(() => {
    let actif = true;
    api('/invoices/restaurant/credit-notes', { token })
      .then((r) => { if (actif) setNotes(r.creditNotes || []); })
      .catch(() => { /* bloc facultatif : sans réponse, il ne s'affiche pas, l'archive des factures reste utilisable */ });
    return () => { actif = false; };
  }, [token]);

  async function telecharger(cn) {
    setOccupe(cn.id);
    try {
      await apiDownload(`/invoices/restaurant/credit-notes/${cn.id}/pdf`, { token, filename: `${cn.creditNoteNumber}.pdf` });
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setOccupe(null);
    }
  }

  if (!notes.length) return null;
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('invoicesResto.creditNotesTitle')}</h3>
      <p className="small" style={{ margin: '0 0 14px' }}>{t('invoicesResto.creditNotesHelp')}</p>
      <div className="invoice-table-wrap">
        <table className="invoice-table">
          <thead>
            <tr>
              <th>{t('invoiceArchive.number')}</th>
              <th>{t('invoicesResto.creditNotesCorrects')}</th>
              <th>{t('invoiceArchive.issuedOn')}</th>
              <th className="num">Total</th>
              <th aria-label={t('invoiceArchive.download')} />
            </tr>
          </thead>
          <tbody>
            {notes.map((cn) => (
              <tr key={cn.id}>
                <td><b>{cn.creditNoteNumber}</b></td>
                <td>{cn.invoiceNumber}</td>
                <td>{new Date(cn.issuedAt).toLocaleDateString(getLocale())}</td>
                <td className="num"><b>{euros(-cn.totalTtc)}</b></td>
                <td className="num">
                  <button type="button" className="btn-ghost" disabled={occupe === cn.id} onClick={() => telecharger(cn)}>
                    {occupe === cn.id ? '...' : 'PDF'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
