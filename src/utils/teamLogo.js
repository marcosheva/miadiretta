import API_URL from '../config/api';

/**
 * URL del logo squadra: preferisce il CDN (team.logo) se presente per evitare 404,
 * altrimenti prova i file locali team_images/ID.png (in produzione con URL backend).
 */
export function teamLogoUrl(team) {
  if (!team) return '';
  if (team.logo && typeof team.logo === 'string' && team.logo.startsWith('http')) return team.logo;
  if (team.id) {
    const path = `/team_images/${team.id}.png`;
    const base = (typeof API_URL === 'string' && API_URL.trim()) ? API_URL.replace(/\/$/, '') : '';
    return base ? `${base}${path}` : path;
  }
  return team.logo || '';
}

/**
 * True se c'è almeno un logo da mostrare (locale o CDN).
 */
export function hasTeamLogo(team) {
  return !!(team && (team.id || team.logo));
}
