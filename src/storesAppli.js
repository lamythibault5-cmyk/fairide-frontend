/* LES LIENS VERS LES STORES, SUR LE SITE (Owen, 2026-11-09 : « quand on scanne le QR des flyers et des autocollants, on doit
 * se voir proposer l'appli »). Les QR imprimés mènent à fairride.be/restaurants (maquettes/flyers/impression,
 * maquettes/kit-comptoir/impression) : avec l'appli installée, le lien universel l'ouvre déjà ; sans elle, c'est le site qui
 * doit la proposer — la bande Android (BandeauAndroid.jsx), la bannière de Safari (index.html, apple-itunes-app) et le bloc
 * de l'accueil (EssaiAppli.jsx : le QR code à côté du faux téléphone, et les deux stores dessous sur téléphone, depuis le
 * 2026-11-12 ; la bande « L'appli fairride », AppComingSoonSection.jsx, est partie avec).
 *
 * Les deux stores sont donnés comme disponibles (Owen, 2026-11-09 : « mets l'iPhone déjà disponible, je la publie ») :
 * mêmes adresses que la mise à jour des applis (miseAJour.js, backend routes/versionAppli.js). */
export const STORES = {
  android: 'https://play.google.com/store/apps/details?id=be.fairide.app',
  ios: 'https://apps.apple.com/be/app/id6826197340'
};

// `support` : d'où vient le clic, pour les statistiques d'installation de la Play Console (paramètre referrer).
export function lienStore(os, support) {
  const url = STORES[os];
  if (os !== 'android') return url;
  return `${url}&referrer=${encodeURIComponent(`utm_source=site&utm_medium=${support}`)}`;
}
