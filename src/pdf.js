import { ouvrirPdfBlob, telechargerPdfBlob } from './natif';

// Contrats et documents en PDF (fondateur, 2026-10-08) : on OUVRE le PDF complet (lecteur du navigateur, ou visionneuse du
// téléphone dans l'application), jamais une page d'impression ni de scan ; et on peut l'ENREGISTRER sous un nom lisible.
async function recuperer(url, token, messageErreur) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(messageErreur || 'Le PDF n\'a pas pu être ouvert.');
  return res.blob();
}
export async function ouvrirPdf(url, token, messageErreur) {
  try { await ouvrirPdfBlob(await recuperer(url, token, messageErreur)); } catch (e) { alert(e.message); }
}
export async function telechargerPdf(url, token, nom, messageErreur) {
  try { const sep = url.includes('?') ? '&' : '?'; await telechargerPdfBlob(await recuperer(`${url}${sep}download=1`, token, messageErreur), nom); } catch (e) { alert(e.message); }
}
