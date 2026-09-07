import whoIsItImg from '@/assets/games/who-is-it.png';
import pokeMotusImg from '@/assets/games/poke-motus.png';
import plusMinusImg from '@/assets/games/plus-minus.png';
import intrusImg from '@/assets/games/intrus.png';
import quiEstCeImg from '@/assets/games/quiestce.png';
import findShinyImg from '@/assets/games/find_shiny.png';
import findNotShinyImg from '@/assets/games/find_not_shiny.png';
import justPriceImg from '@/assets/games/just_price.png';
import leBonShinyImg from '@/assets/games/le_bon_shiny.png';
import lePokedexImg from '@/assets/games/le-pokedex.png';

export interface HomeGame {
  title: string;
  description: string;
  to: string;
  iconImg: string;
  // Cle du groupe de quetes (DailyGameGroup.key) pour le badge "terminé". Absent pour le multi.
  completionKey?: string;
}

// Liste partagee des jeux de l'accueil.
export const HOME_GAMES: HomeGame[] = [
  { title: 'Silhouette', description: 'Devine le Pokémon caché', to: '/jouer', iconImg: whoIsItImg, completionKey: 'WHO_IS_IT' },
  { title: 'Poké-Motus', description: 'Trouve le nom du Pokémon', to: '/motus', iconImg: pokeMotusImg, completionKey: 'MOTUS' },
  { title: 'Plus ou Moins', description: 'Compare les statistiques', to: '/plus-ou-moins', iconImg: plusMinusImg, completionKey: 'PLUS_MINUS' },
  { title: "L'Intrus", description: 'Repère celui qui ne va pas', to: '/intrus', iconImg: intrusImg, completionKey: 'INTRUDER' },
  { title: 'La Juste Stat', description: 'Devine la valeur exacte', to: '/juste-stat', iconImg: justPriceImg, completionKey: 'JUST_STAT' },
  { title: 'Le Bon Shiny', description: 'Repère le shiny authentique', to: '/bon-shiny', iconImg: leBonShinyImg, completionKey: 'TRUE_SHINY' },
  { title: 'Trouve le shiny', description: 'Repère le Pokémon shiny', to: '/shiny', iconImg: findShinyImg, completionKey: 'SHINY_FIND_SHINY' },
  { title: 'Trouve le non-shiny', description: "Repère celui qui n'est pas shiny", to: '/non-shiny', iconImg: findNotShinyImg, completionKey: 'SHINY_FIND_NON_SHINY' },
  { title: 'Le Pokédex', description: 'Déduis le Pokémon du jour', to: '/le-pokedex', iconImg: lePokedexImg, completionKey: 'POKEDEX' },
  { title: 'Qui est-ce', description: 'Duel 1 contre 1 en temps réel', to: '/qui-est-ce', iconImg: quiEstCeImg },
];
