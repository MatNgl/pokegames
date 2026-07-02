// Couleur dediee par niveau, partagee par le panneau de choix et les arenes de jeu.
// Rampe de difficulte issue de la marque : vert -> jaune -> orange -> rouge.
const LEVEL_COLOR: Record<string, string> = {
  FACILE: '#5FB24A',
  MOYEN: '#EAB308',
  DIFFICILE: '#E8730C',
  EXTREME: '#EE1515',
};

export function levelColor(level: string): string {
  return LEVEL_COLOR[level] ?? '#3B4CCA';
}

// Teinte tres claire (le meme ton, en transparence) pour un fond de carte discret.
export function levelTint(level: string, alpha = 0.08): string {
  const hex = levelColor(level).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
