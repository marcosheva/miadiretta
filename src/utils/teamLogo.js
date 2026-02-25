/**
 * URL del logo squadra: preferisce i file locali in team_images/ (id squadra = nome file .png),
 * altrimenti usa l'URL CDN (team.logo).
 * @param {{ id?: string, logo?: string } | null} team - oggetto con id e/o logo
 * @returns {string} URL da usare come src dell'img
 */
export function teamLogoUrl(team) {
  if (!team) return '';
  if (team.id) return `/team_images/${team.id}.png`;
  return team.logo || '';
}

/**
 * True se c'è almeno un logo da mostrare (locale o CDN).
 */
export function hasTeamLogo(team) {
  return !!(team && (team.id || team.logo));
}
