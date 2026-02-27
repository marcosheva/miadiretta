const BETSAPI_CDN = 'https://assets.b365api.com/images/team/m';

// 1x1 trasparente: usato su errore caricamento logo per nascondere icona rotta e evitare nuovi request
export const LOGO_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function teamLogoUrl(team) {
  if (!team) return '';
  if (team.logo && typeof team.logo === 'string' && team.logo.startsWith('http')) return team.logo;
  if (team.id) return `${BETSAPI_CDN}/${team.id}.png`;
  return '';
}

// Mostra il logo se abbiamo team.logo (URL) o team.id (si prova il CDN; su 404 si nasconde con onLogoError).
export function hasTeamLogo(team) {
  if (!team) return false;
  if (team.logo && typeof team.logo === 'string' && team.logo.startsWith('http')) return true;
  if (team.id) return true;
  return false;
}
