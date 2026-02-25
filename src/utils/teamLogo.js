import API_URL from '../config/api';

/**
 * URL del logo squadra: preferisce i file locali in team_images/ (id squadra = nome file .png),
 * altrimenti usa l'URL CDN (team.logo).
 * In produzione usa l'URL completo del backend per team_images (frontend su altro dominio).
 */
export function teamLogoUrl(team) {
  if (!team) return '';
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
