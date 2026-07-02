import whoIsItImg from '@/assets/games/who-is-it.png';
import pokeMotusImg from '@/assets/games/poke-motus.png';
import plusMinusImg from '@/assets/games/plus-minus.png';
import intrusImg from '@/assets/games/intrus.png';
import quiEstCeImg from '@/assets/games/quiestce.png';
import findShinyImg from '@/assets/games/find_shiny.png';
import justPriceImg from '@/assets/games/just_price.png';
import leBonShinyImg from '@/assets/games/le_bon_shiny.png';

export interface HomeGame {
  title: string;
  description: string;
  to: string;
  iconImg: string;
}

// Liste partagee par les variantes d'accueil (previsualisations).
export const HOME_GAMES: HomeGame[] = [
  { title: 'Silhouette', description: 'Devine le Pokémon caché', to: '/jouer', iconImg: whoIsItImg },
  { title: 'Poké-Motus', description: 'Trouve le nom du Pokémon', to: '/motus', iconImg: pokeMotusImg },
  { title: 'Plus ou Moins', description: 'Compare les statistiques', to: '/plus-ou-moins', iconImg: plusMinusImg },
  { title: "L'Intrus", description: 'Repère celui qui ne va pas', to: '/intrus', iconImg: intrusImg },
  { title: 'La Juste Stat', description: 'Devine la valeur exacte', to: '/juste-stat', iconImg: justPriceImg },
  { title: 'Le Bon Shiny', description: 'Repère le shiny authentique', to: '/bon-shiny', iconImg: leBonShinyImg },
  { title: 'Trouve le shiny', description: 'Repère le Pokémon shiny', to: '/shiny', iconImg: findShinyImg },
  { title: 'Qui est-ce', description: 'Duel 1 contre 1 en temps réel', to: '/qui-est-ce', iconImg: quiEstCeImg },
];
