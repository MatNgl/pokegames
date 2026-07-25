/**
 * Source de verite unique des metadonnees par route. Utilisee a trois endroits :
 *   - le composant <Seo> (React 19 hoiste nativement title/meta/link dans le head) ;
 *   - la generation du sitemap.xml au build ;
 *   - le prerendu statique, qui ecrit ce contenu en HTML pour les crawlers (IA comprises)
 *     qui n'executent pas JavaScript.
 *
 * Ce fichier ne doit importer que du type pur : il est aussi charge par vite.config.ts au build.
 */

export const SITE_NAME = 'Poké-Idle';

// Domaine de production : sert aux URL canoniques, aux balises Open Graph et au sitemap.
// Une seule ligne a changer en cas de changement de nom de domaine.
export const SITE_URL = 'https://poke-idle.fr';

export interface RouteMeta {
  path: string;
  title: string; // titre complet de l'onglet
  description: string; // meta description, une phrase
  h1: string;
  intro: string; // paragraphe d'introduction, visible par les crawlers
  rules?: string[]; // regles du jeu : du vrai contenu textuel pour les moteurs IA
  indexable: boolean; // false = noindex (pages privees ou sans interet de referencement)
}

export const ROUTES_META: RouteMeta[] = [
  {
    path: '/',
    title: `${SITE_NAME}, des mini-jeux Pokémon quotidiens et gratuits`,
    description:
      'Huit mini-jeux Pokémon gratuits, un nouveau défi chaque jour : devine la silhouette, trouve le shiny, compare les statistiques et affronte un adversaire en duel.',
    h1: 'Poké-Idle, ton rendez-vous quotidien de dresseur',
    intro:
      "Poké-Idle réunit huit mini-jeux Pokémon jouables gratuitement dans le navigateur, sans installation. Chaque jour, une nouvelle série de défis identique pour tous les joueurs : devine un Pokémon à sa silhouette, retrouve son nom lettre par lettre, repère le shiny au milieu des imposteurs, compare les statistiques ou démasque l'intrus. Un mode multijoueur en temps réel permet aussi de s'affronter en un contre un.",
    rules: [
      'Un nouveau défi par jeu et par niveau chaque jour, identique pour tous les joueurs.',
      'Une seule tentative par jour et par défi : le classement compare les performances du jour.',
      'Jouable sans compte, mais un compte permet de sauvegarder ses résultats et son Pokédex.',
    ],
    indexable: true,
  },
  {
    path: '/jouer',
    title: `Quel est ce Pokémon ? Devine la silhouette | ${SITE_NAME}`,
    description:
      "Devine chaque jour le nom du Pokémon caché derrière sa silhouette, avec des indices débloqués à chaque erreur et quatre niveaux de difficulté.",
    h1: 'Quel est ce Pokémon ?',
    intro:
      "Une silhouette noire s'affiche à l'écran : à toi de retrouver le nom du Pokémon. Chaque mauvaise réponse débloque un indice supplémentaire (type, taille, génération, aperçu en couleur). L'objectif est de trouver en un minimum d'essais.",
    rules: [
      'Saisie libre du nom, avec autocomplétion parmi les noms français officiels.',
      'Chaque erreur débloque l’indice suivant : type, taille, génération, puis aperçu en couleur.',
      'Quatre niveaux : Facile (générations 1 à 3), Moyen, Difficile (zoom et rotation), Extrême.',
      'Le score correspond au nombre total d’essais : le plus faible gagne.',
    ],
    indexable: true,
  },
  {
    path: '/motus',
    title: `Poké-Motus, le Wordle des noms de Pokémon | ${SITE_NAME}`,
    description:
      'Trouve le nom du Pokémon du jour lettre par lettre, façon Wordle, avec un code couleur qui indique les lettres bien placées.',
    h1: 'Poké-Motus',
    intro:
      "Le principe de Wordle appliqué aux noms de Pokémon. Un nom mystère est tiré chaque jour : propose des noms de Pokémon de la bonne longueur et déduis la solution grâce au code couleur renvoyé à chaque tentative.",
    rules: [
      'Vert : lettre correcte et bien placée. Jaune : lettre présente mais mal placée. Noir : absente.',
      'Chaque proposition doit être un vrai nom de Pokémon de la bonne longueur.',
      'Quatre niveaux, de 4 à 6 essais selon la difficulté ; la première lettre est donnée en Facile et Moyen.',
    ],
    indexable: true,
  },
  {
    path: '/plus-ou-moins',
    title: `Plus ou Moins, duel de statistiques Pokémon | ${SITE_NAME}`,
    description:
      'Deux Pokémon s’affrontent : désigne celui qui a la plus grande valeur de PV, d’attaque, de vitesse, de taille ou de poids.',
    h1: 'Plus ou Moins',
    intro:
      'À chaque manche, deux Pokémon sont mis face à face et une caractéristique est tirée au sort. Clique sur celui qui possède la plus grande valeur. Dix duels par partie, et un écart entre les deux valeurs qui se resserre à mesure que le niveau augmente.',
    rules: [
      'Dix duels par partie, une caractéristique différente à chaque manche.',
      'Caractéristiques possibles : PV, attaque, défense, vitesse, taille, poids et numéro de Pokédex.',
      'Quatre niveaux : plus le niveau est élevé, plus les deux valeurs sont proches.',
    ],
    indexable: true,
  },
  {
    path: '/intrus',
    title: `L’Intrus, trouve le Pokémon qui ne va pas | ${SITE_NAME}`,
    description:
      'Plusieurs Pokémon partagent un point commun caché, sauf un : identifie l’intrus parmi la grille du jour.',
    h1: 'L’Intrus',
    intro:
      'Une grille de Pokémon s’affiche. Tous partagent un critère secret (type, génération, seuil de statistique, stade d’évolution ou méga-évolution) sauf un seul. À toi de repérer lequel ne rentre pas dans le lot.',
    rules: [
      'Cinq grilles par jour, le critère commun change à chaque manche.',
      'Critères possibles : type, génération, seuil de statistique, forme finale, méga-évolution.',
      'Trois niveaux : de 4 à 6 Pokémon par grille, avec un indice plus ou moins explicite.',
    ],
    indexable: true,
  },
  {
    path: '/juste-stat',
    title: `La Juste Stat, devine la statistique exacte | ${SITE_NAME}`,
    description:
      'Devine la valeur exacte d’une statistique de Pokémon en vingt secondes, guidé par des indications plus haut ou plus bas.',
    h1: 'La Juste Stat',
    intro:
      'Un Pokémon et une caractéristique te sont imposés : trouve la valeur exacte. À chaque proposition, le jeu indique si la vraie valeur est plus haute ou plus basse. Trois manches, vingt secondes chacune.',
    rules: [
      'Trois manches par jour, chacune limitée à vingt secondes.',
      'Après chaque proposition, une flèche indique plus haut ou plus bas.',
      'Statistiques possibles : PV, attaque, défense, vitesse, taille en centimètres, poids en kilos.',
    ],
    indexable: true,
  },
  {
    path: '/bon-shiny',
    title: `Le Bon Shiny, repère la couleur chromatique authentique | ${SITE_NAME}`,
    description:
      'Toutes les vignettes montrent le même Pokémon shiny, mais une seule affiche ses vraies couleurs chromatiques : trouve laquelle.',
    h1: 'Le Bon Shiny',
    intro:
      'Plusieurs vignettes du même Pokémon shiny sont affichées côte à côte. Toutes ont subi une altération de teinte, sauf une : la version chromatique officielle. Repère la seule couleur authentique.',
    rules: [
      'Cinq manches par jour, un Pokémon différent à chaque manche.',
      'Une seule vignette affiche la couleur chromatique officielle, les autres sont altérées.',
      'Trois niveaux : de 3 à 6 vignettes à départager.',
    ],
    indexable: true,
  },
  {
    path: '/shiny',
    title: `Trouve le shiny parmi les Pokémon | ${SITE_NAME}`,
    description:
      'Un seul Pokémon de la grille arbore ses couleurs chromatiques : repère le shiny le plus vite possible.',
    h1: 'Trouve le shiny',
    intro:
      'Plusieurs Pokémon différents sont affichés, et un seul est sous sa forme chromatique. Repère-le. Le nombre de vignettes augmente avec le niveau de difficulté.',
    rules: [
      'Cinq manches par jour, un seul Pokémon shiny par grille.',
      'Trois niveaux : 3, 4 ou 6 vignettes.',
      'Le mode inversé, Trouve le non-shiny, propose le défi symétrique.',
    ],
    indexable: true,
  },
  {
    path: '/non-shiny',
    title: `Trouve le non-shiny, le défi inversé | ${SITE_NAME}`,
    description:
      'Tous les Pokémon affichés sont chromatiques sauf un : retrouve celui qui arbore ses couleurs normales.',
    h1: 'Trouve le non-shiny',
    intro:
      'La variante inversée du défi shiny. Cette fois, tous les Pokémon de la grille sont chromatiques à l’exception d’un seul : identifie celui qui affiche ses couleurs normales.',
    rules: [
      'Cinq manches par jour, un seul Pokémon non chromatique par grille.',
      'Trois niveaux selon le nombre de vignettes.',
      'Défi quotidien distinct de celui du mode Trouve le shiny.',
    ],
    indexable: true,
  },
  {
    path: '/qui-est-ce',
    title: `Qui est-ce ? Duel Pokémon en un contre un | ${SITE_NAME}`,
    description:
      'Affronte un autre joueur en temps réel : pose des questions fermées pour deviner son Pokémon secret avant qu’il ne trouve le tien.',
    h1: 'Qui est-ce ?',
    intro:
      'Le jeu de déduction classique, version Pokémon et multijoueur. Chaque joueur reçoit un Pokémon secret tiré d’une grille commune. À tour de rôle, on pose une question fermée, on élimine les cartes incompatibles, et le premier qui devine le Pokémon adverse gagne.',
    rules: [
      'Duel en un contre un, en temps réel, via la file d’attente ou un code de salon.',
      'Grille commune de 25 Pokémon, un Pokémon secret par joueur.',
      'Questions à réponse Oui ou Non, puis élimination des cartes incompatibles.',
      'Une réponse finale erronée fait perdre la partie immédiatement.',
    ],
    indexable: true,
  },
  {
    path: '/pokedex',
    title: `Pokédex, ta collection de Pokémon | ${SITE_NAME}`,
    description:
      'Collectionne les Pokémon cachés sur le site et complète ton Pokédex personnel, génération par génération.',
    h1: 'Pokédex',
    intro:
      'Des silhouettes de Pokémon se cachent discrètement sur les pages du site. Clique dessus pour les capturer et les ajouter à ton Pokédex personnel. Dix apparitions par jour, tirées parmi les espèces qui te manquent encore.',
    rules: [
      'Dix silhouettes cachées par jour, réparties sur les différentes pages.',
      'Un Pokémon déjà capturé ne réapparaît plus.',
      'La collection se consulte par génération, avec la fiche détaillée de chaque capture.',
    ],
    indexable: true,
  },
  {
    path: '/classements',
    title: `Classements du jour | ${SITE_NAME}`,
    description:
      'Compare tes performances du jour avec celles des autres dresseurs, jeu par jeu et niveau par niveau.',
    h1: 'Classement du jour',
    intro:
      'Chaque défi quotidien possède son propre classement. Les joueurs connectés y apparaissent avec leur résultat du jour, départagé selon la métrique propre à chaque jeu : nombre d’essais, bonnes réponses ou rapidité.',
    indexable: true,
  },
  // Pages privees ou sans interet de referencement : servies normalement, mais en noindex.
  { path: '/connexion', title: `Connexion | ${SITE_NAME}`, description: 'Connecte-toi pour sauvegarder tes résultats quotidiens et ton Pokédex.', h1: 'Connexion', intro: 'Accède à ton compte Poké-Idle.', indexable: false },
  { path: '/inscription', title: `Créer un compte | ${SITE_NAME}`, description: 'Crée un compte gratuit pour suivre ta progression et apparaître dans les classements.', h1: 'Créer un compte', intro: 'Rejoins Poké-Idle en quelques secondes.', indexable: false },
  { path: '/quetes', title: `Quêtes du jour | ${SITE_NAME}`, description: 'Suis les défis du jour qu’il te reste à terminer.', h1: 'Quêtes du jour', intro: 'La liste de tous les défis quotidiens et leur avancement.', indexable: false },
  { path: '/historique', title: `Mon historique | ${SITE_NAME}`, description: 'Retrouve l’historique de tes défis quotidiens terminés.', h1: 'Mon historique', intro: 'L’ensemble de tes résultats passés.', indexable: false },
  { path: '/admin', title: `Administration | ${SITE_NAME}`, description: 'Espace réservé aux administrateurs.', h1: 'Administration', intro: 'Espace réservé aux administrateurs.', indexable: false },
];

export function findRouteMeta(path: string): RouteMeta | undefined {
  // Le prerendu sert /motus/ (fichier d'index de dossier) alors que les routes sont declarees sans
  // slash final : on normalise pour que les deux formes trouvent la meme fiche.
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return ROUTES_META.find((r) => r.path === normalized);
}

/** Routes referencables : alimentent le sitemap et le prerendu. */
export const INDEXABLE_ROUTES = ROUTES_META.filter((r) => r.indexable);

/** JSON-LD decrivant le site et l'application (schema.org). */
export function buildJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        inLanguage: 'fr-FR',
        description: ROUTES_META[0]?.description ?? '',
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Tout navigateur web',
        inLanguage: 'fr-FR',
        description: ROUTES_META[0]?.description ?? '',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
    ],
  };
}
