# PokéGames - Documentation & Contrat d'Architecture (`claude.md`)

Ce document est le **référentiel unique et impératif** pour toute IA (Claude, Gemini, GPT, Cursor, etc.) ou développeur intervenant sur le projet **PokéGames**. Il doit être consulté avant toute modification pour maintenir l'intégrité architecturale, les règles d'anti-triche et la cohérence des mini-jeux.

---

## 1. Vision et Persona de l'IA
* **Rôle :** Architecte Logiciel & Développeur Full-Stack Senior.
* **Expertise :** TypeScript strict, React (Vite/Next.js), NestJS, PostgreSQL/Prisma, Redis & WebSockets (Socket.io), Sécurité (Anti-triche, Data Masking).
* **Philosophie :** Code modulaire, propre, maintenable et sécurisé par design. Expliquer concisément le *pourquoi* des choix techniques complexes.
* **Communication (règle) :** messages très succincts. Ne pas narrer les analyses ni les étapes intermédiaires. Aller droit au but : une question directe, ou une explication en 3 lignes maximum à la fin. Le travail parle de lui-même (code, tests, commits).

---

## 2. Stack Technique du Monorepo
* **Monorepo :** **npm workspaces** (`apps/*`, `packages/*`).
* **Frontend (`apps/web`) :** React + Vite + TypeScript + TailwindCSS + Framer Motion. Layout SPA `100vh` temps réel ultra-fluide.
* **Backend (`apps/api`) :** NestJS + TypeScript.
* **Base de Données :** PostgreSQL 16 géré via l'ORM **Prisma**.
* **Temps Réel & Cache :** Redis 7 couplé à Socket.io pour les sessions multijoueurs, le matchmaking et l'invalidation d'états temporaires.
* **Paquet Partagé (`packages/shared-types`) :** Contient 100% des contrats de données (DTOs, événements WebSockets, types de session).
* **Déploiement :** Conteneurisation Docker & Docker Compose (prêt pour VPS privé).

---

## 3. Les 6 Règles d'Or Inviolables

### Règle 1 : Typage Strict (Zéro `any`)
* L'utilisation du mot-clé `any` est **formellement et définitivement interdite** dans tout le code (sources et tests).
* Utiliser exclusivement des types explicites, des `interface`, des génériques ou `unknown` accompagné de *type guards*.
* Option `"noImplicitAny": true` et `"strict": true` forcées dans `tsconfig.base.json`.

### Règle 2 : Anti-Triche & Data Masking (Zéro Fuite Réseau)
* Le frontend ne doit **JAMAIS** recevoir la solution d'un jeu dans les réponses réseau (ni dans les payloads JSON, ni dans les en-têtes, ni dans les URL d'images) avant la fin officielle du round.
* **Masquage des Sprites :** Les images des Pokémon en cours de jeu ne sont jamais appelées par leur nom ou ID réel (`/sprites/pikachu.png` ou `/sprites/25.png` interdis). Elles passent par un point d'accès proxy sécurisé : `/api/sprites/:sessionHash` (où `:sessionHash` est un UUID temporaire généré par Redis/NestJS pour la manche).
* Le flux binaire retourné ne contient aucune métadonnée EXIF révélatrice.

### Règle 3 : Indépendance des Données (Pipeline ETL Tyradex)
* Le client (Frontend) ne fait **JAMAIS** d'appels à des API externes (PokéAPI, Tyradex, etc.).
* Le backend NestJS dispose d'un service d'extraction (ETL) qui aspire périodiquement ou à l'initialisation les données depuis l'API **Tyradex** (`https://tyradex.app/api/v1/pokemon`) pour les persister dans notre base PostgreSQL locale via Prisma.
* Cible prioritaire Lot 1 : Données en **Français** (noms, types, descriptions, statistiques). Lot 2 : Anglais.

### Règle 4 : Autorité du Serveur (State Machine Multijoueur)
* En multijoueur comme en solo, la **State Machine** (logique de jeu, minuteurs, calcul des scores, validation des réponses) est **exclusivement gérée côté serveur** (NestJS + Redis).
* Le client se contente d'émettre des actions (`SUBMIT_GUESS`, `SELECT_OPTION`) et de rendre visuellement les changements d'état (`ROUND_START`, `GUESS_RESULT`, `GAME_OVER`).

### Règle 5 : Suivi Asynchrone par Événements (*Job Event* & Audit Admin)
* Toute fin de manche (victoire ou timeout) doit émettre un événement de domaine de façon asynchrone via **EventEmitter2** (`game.round.completed`).
* Un *Job Event* dédié (`GameAuditListener`) écoute cet événement en arrière-plan (`{ async: true }`) et persiste un historique d'audit exhaustif dans la table **`GameAuditLog`** de PostgreSQL.
* Ce découplage garantit une latence nulle pour le joueur tout en offrant aux administrateurs une observabilité totale (durée, tentatives, indices utilisés, détection d'anomalies via `/admin/audit/logs`).

### Règle 6 : Zéro trace d'IA (rendu humain, pro et simple)
* Aucun texte au ton "IA générée" : pas de formules creuses, de remplissage, de phrases d'introduction ou de conclusion automatiques, ni de commentaires de code qui paraphrasent l'évidence. On écrit comme un humain : court, direct, utile.
* Aucun tiret long (le tiret cadratin et le tiret demi-cadratin sont proscrits), ni dans le code, ni dans les commentaires, ni dans l'interface. On utilise le point, la virgule, les deux-points, les parenthèses ou un tiret simple selon le cas.
* Aucun emoji nulle part : code, commentaires, logs, messages d'erreur, libellés d'interface, et documentation comprise.
* Pas de dégradé criard ni de palette « IA » (violet/rose génériques). Les couleurs sont vives et joyeuses mais **issues de la marque Pokémon** et cadrées par le guide UI/UX (bleu/vert/jaune/rouge sur surfaces crème). On vise un rendu de fan-game soigné, pas un thème générique d'IA.
* Le style visuel et le code s'appuient sur des références humaines existantes (bibliothèques et patterns reconnus), jamais sur une esthétique inventée au fil de l'eau. Objectif constant : pro, simple, lisible.
* **Orthographe irréprochable et accents français :** Toujours écrire correctement les mots français avec leurs accents dans tout le projet (textes d'interface, messages d'erreur, commentaires, documentation). Par exemple : "Vérifiez que l'API est démarrée." et non "Verifiez que l'API est demarree." Une attention stricte doit être portée à chaque écran front pour proscrire tout mot sans accent.

---

## 4. Guide UI/UX (Style Rétro Pokémon, vivant et coloré)
* **Inspiration :** `Pokédle` et les fan-games Pokémon rétro (esthétique Game Boy / Pokémon). Objectif : un rendu **ludique, coloré et vivant** qui donne envie de jouer, jamais un rendu sérieux ou générique qui sent l'IA.
* **Thème :** **thème unique** (pas de dark/light), clair et coloré. Fond « monde Pokémon » : ciel dégradé bleu, nuages doux, bande d'herbe verte en bas. Surfaces en **carte crème** (`#F7F3D7`) à **bordure olive épaisse** et légère ombre portée, façon boîte de jeu.
* **Palette :** bleu Pokémon `#3B4CCA` (actions principales), vert `#5FB24A` (pastilles et états positifs), jaune `#FFCB05` (marque et accents), rouge `#EE1515` (erreur), texte sombre `#2B2A24` sur les surfaces crème. Couleurs vives mais maîtrisées et issues de la marque Pokémon (référence humaine assumée, pas un dégradé criard d'IA).
* **Typographie :** **Press Start 2P** (police pixel) pour le logo, les titres et les libellés courts ; **Nunito** (sans-serif ronde et lisible) pour le corps, les champs et les textes longs. Chargées en local via `@fontsource`.
* **Mise en valeur :** Artworks officiels HD (sprites réguliers et shinies de haute qualité). La silhouette à deviner est rendue en **noir plein** sur l'écran clair de la carte (classique « Quel est ce Pokémon »).
* **Disposition (`100vh`, un seul écran, pas de scroll global) :** centre dominant. Tout le reste de l'écran est dédié au jeu, aéré, et tient sans scroll.
  * **Header haut, à gauche :** accès aux autres mini-jeux (navigation principale).
  * **Header haut, à droite :** paramètres, Pokédex et autres outils, sous forme d'icônes discrètes. Le Pokédex s'ouvre à la demande (drawer ou modale), il n'occupe pas de colonne permanente.
  * **Zone centrale (`flex-1`) :** l'arène de jeu, qui prend la quasi-totalité de l'écran. Animations fluides des manches.
  * Pas de colonnes latérales permanentes : profil, statistiques et chat éventuel s'ouvrent en panneau contextuel, jamais en permanence.
* **Page d'accueil :** simple, centrée sur un des jeux directement jouable, sans surcharge.

### Bibliothèques et tokens front (décisions actées)
* **Composants UI :** **shadcn/ui** (primitives Radix + Tailwind, code copié dans le repo, aucune lib lourde imposée). Tout composant récurrent vit dans `apps/web/src/components/ui`.
* **Icônes :** **lucide-animated** (`https://lucide-animated.com`), variante animée de Lucide. Trait fin homogène, animation discrète sur interaction uniquement. Pour les ajouter via shadcn :
  * Paramètres : `pnpm dlx shadcn@latest add "https://lucide-animated.com/r/settings.json"`
  * Défi quotidien (Daily) : `pnpm dlx shadcn@latest add "https://lucide-animated.com/r/calendar-days.json"`
  * Pokédex : `pnpm dlx shadcn@latest add "https://lucide-animated.com/r/folder-kanban.json"`
* **Polices :** **Press Start 2P** (pixel, `--font-display`) pour logo/titres/libellés courts et **Nunito** (`--font-sans`) pour le corps. Chargées en local via `@fontsource/press-start-2p` et `@fontsource-variable/nunito`.
* **Couleurs (tokens) :** voir la palette ci-dessus, exposée en variables CSS via `@theme` Tailwind v4 (`--color-primary`, `--color-go`, `--color-accent`, `--color-surface`, `--color-border`...). Boutons épais à ombre basse (effet 3D façon jeu), cartes crème à bordure olive. Couleurs vives mais cadrées par la marque, jamais de dégradé criard d'IA (cf. Règle 6).
* **État serveur :** **TanStack Query** pour le cache HTTP, les états de chargement et l'invalidation.
* **Formulaires :** **react-hook-form** couplé à **zod** pour la validation (schémas zod partagés depuis `packages/shared-types` quand c'est pertinent).
* **Animations :** Framer Motion pour les transitions de manche, dosées et fonctionnelles, jamais décoratives à l'excès.
* **Navigation & Performance (Bonnes Pratiques Front) :**
  * **Lazy Loading :** Chargement différé (`React.lazy` + `Suspense`) systématique sur les routes et écrans de jeux afin de réduire le bundle initial.
  * **Skeletons (États de chargement) :** Affichage de composants Skeletons élégants et fluides (`Skeleton` shadcn) pendant les requêtes TanStack Query ou le chargement initial des sprites/données afin d'éviter tout saut visuel (CLS) ou écran vide.
* **Thème :** **thème unique** clair et coloré (pas de bascule dark/light). Tokens sémantiques centralisés dans `index.css` (`@theme`).
* **Tests front :** **Vitest** pour l'unitaire et les composants. Objectif zéro erreur `typecheck` et zéro erreur de lint avant toute fin de tâche.
* **Skill UI/UX obligatoire :** tout le travail front s'appuie sur le skill **ui-ux-pro-max** (`https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`). Il est activé pour chaque écran et chaque composant afin de garantir un rendu de niveau pro, sans tomber dans les travers listés à la Règle 6.

### Fond du site (décision actée)
* **Fond unique « monde Pokémon »** sur toutes les pages (accueil, connexion, inscription, jeu) : composant `AppBackground` (`apps/web/src/components/backgrounds/app-background.tsx`). Ciel dégradé bleu, quelques nuages doux en dérive lente, bande d'herbe verte en bas. Aucune dépendance externe (CSS pur), léger.
* Le fond reste en arrière-plan et ne concurrence jamais le contenu : le jeu se joue dans une carte crème lisible posée par-dessus.
* L'ancien fond `LightPillar` (React Bits + `three`) et le motif à points sombre ont été retirés avec le pivot vers le thème rétro coloré.

### Philosophie produit (simple et joueur)
* Référence d'esprit : `Pokédle`. Objectif : **peu de pages, peu d'informations par écran**, navigation immédiate, ambiance ludique. L'utilisateur sait toujours où aller.
* Pas de tableaux de bord surchargés, pas de menus profonds. Une action principale claire par écran.
* Page d'accueil = sélection des jeux directement (pas de page marketing), en boîtes façon jeu (titre pixel + pastille verte décrivant le jeu).

---

## 5. Spécifications Détaillées des Jeux Pokémon

**Format général (décision actée) :** les jeux du site sont centrés sur le **défi quotidien** : une seule session par jour et par joueur, série déterministe identique pour tous (graine du jour). Cela vaut pour tous les modes solo. Seul le jeu multijoueur (« Qui est-ce ? ») échappe à cette règle (parties à la demande). L'unicité par jour est garantie côté client en v1 et devra être verrouillée côté serveur (par compte et par date) ensuite.

**Niveaux de difficulté (décision actée) :** plusieurs jeux ont 3 ou 4 niveaux (Facile, Moyen, Difficile, parfois Extrême). Chaque couple (jeu x niveau) est un **défi quotidien distinct** : série déterministe propre, une session par jour et par niveau, persistance et statut séparés. Le joueur choisit son niveau via un **écran de choix intermédiaire** (carte d'accueil, puis écran listant les niveaux avec leur statut Terminé / En cours, puis la partie). Les jeux sans niveau (La Juste Stat) vont directement à la partie. Les valeurs par niveau vivent dans la config serveur (voir Paramètres admin).

**Anti-répétition (décision actée) :** pour ne pas retomber sur les mêmes Pokémon (ni les mêmes stats ou critères) d'un jour à l'autre, un **historique global des tirages** est persisté dans la table `DailyPick` (globale, partagée par tous, puisque les défis sont déterministes et identiques pour tous). Les générateurs **excluent** les Pokémon et les dimensions secondaires (stat, critère) sortis les jours précédents (fenêtre glissante sur N jours), et **à l'intérieur d'une même session** on ne rejoue jamais deux fois le même Pokémon ni trop souvent la même stat. Brique de base livrée : `HistoryService` (`recordPicks`, `hasPicksFor`, `recentPokemonIds`, `recentDetails`), à brancher jeu par jeu (exclusion au tirage, puis `recordPicks` une fois le tirage du jour figé).

**Paramètres admin (config dynamique, décision actée) :** tous les paramètres réglables des jeux (nombre de manches, seuils d'écart, longueurs de mot, tailles de grille, teintes, niveaux, stats autorisées, chrono, fenêtres d'anti-répétition...) sont la **source de vérité unique en base** (table `GameConfig`), lus par les services via `GameConfigService` (chargé en mémoire au démarrage, seedé depuis les valeurs par défaut de `game-config.ts` si absent). Plus aucune constante n'est lue directement par les services. Édition à chaud via `/admin/games/config` (GET/PUT) et l'onglet Configuration de l'écran admin. Les valeurs de `game-config.ts` ne servent plus qu'au seed initial.

**Anti-triche des vignettes (décision actée) :** deux mécanismes coexistent. La Silhouette utilise le proxy masqué `/api/sprites/:sessionHash` (silhouette puis couleur selon l'état serveur). Les jeux qui affichent plusieurs vignettes secrètes (Trouve le shiny, Le Bon Shiny) utilisent un **proxy opaque par slot** propre au jeu (ex. `/api/games/true-shiny/tile/:roundId/:round/:slot`) : l'URL n'expose ni le Pokémon, ni la nature shiny, ni la transformation. Les jeux à sprites visibles (Plus ou Moins, La Juste Stat, L'Intrus) servent les sprites en clair via `/api/pokemon/:id/sprite`, car l'identité n'est pas le secret (le secret est la bonne réponse, jamais envoyée avant le choix).

### 1. Quel est ce Pokémon ? (*Who's That Pokémon*)
* **Concept :** le joueur fait face à la silhouette masquée d'un Pokémon et doit deviner son nom français.
* **Réponse :** saisie libre avec autocomplétion proposant des noms valides. La validation est faite côté serveur, jamais par comparaison côté client. Le nom saisi est normalisé avant comparaison au nom français canonique (minuscules, accents neutralisés, tirets et espaces normalisés ; cas particuliers comme les symboles de genre gérés).
* **Tentatives :** illimitées par défaut. Il n'y a pas d'échec : la manche se termine quand le joueur trouve. Un plafond de tentatives optionnel peut être imposé en admin (au-delà, la manche se clôt et la réponse est révélée).
* **Indices (échelle fixe, débloqués à chaque essai) :** chaque mauvaise réponse ouvre le palier d'indice suivant. Ordre fixe (réglable en admin) : **Type 1** (après la 1re erreur), **Taille exacte** (après la 2e), **Génération** (après la 3e), **aperçu couleur flouté** (après la 4e). Au palier courant, le joueur choisit de révéler l'indice ou de continuer à deviner. Côté front, les indices sont des **icônes compactes à largeur fixe à droite de la silhouette** (révéler une valeur ne décale jamais l'image), verrouillées tant que non débloquées, cliquables une fois disponibles. L'icône des indices de couleur utilise l'asset `couleur_reveal.png`.
* **Niveaux :** **Facile** (générations 1 à 3, silhouette noire plein cadre, zoom 100 %, sans rotation), **Moyen** (toutes générations, zoom ciblé sur une zone, dézoom progressif à chaque erreur), **Difficile** (toutes générations, zoom + rotation d'environ 30° redressée à chaque erreur), **Extrême** (catalogue élargi incluant méga-évolutions, formes régionales et spéciales, zoom fort + angle aléatoire, dézoom et redressement progressifs). Les facteurs `zoomRatio` et `rotationAngle` sont **calculés exclusivement côté serveur** (state machine) et transmis dans le DTO de la manche ; le client applique ces transformations sans jamais posséder les coordonnées réelles ni le sprite couleur avant la résolution. Valeurs exactes par niveau dans `game-config.ts` (`WHO_IS_IT_ADMIN_CONFIG`).
* **Révélation de couleur (anti-triche) :** les niveaux de couleur ne dévoilent jamais le vrai sprite côté client. Le serveur sert des variantes masquées par niveau (`colorLevel`) : silhouette noire (0), couleur très floutée (1), couleur défloutée (2), via le proxy `/api/sprites/:sessionHash`. Le sprite net n'est servi qu'après résolution de la manche.
* **Décompte (essais, pas de points) :** on ne compte **pas de points**, seulement le **nombre d'essais** (réponses soumises) cumulé sur les manches de la partie. Objectif : deviner les Pokémon en le moins d'essais possible. Les indices aident sans pénalité chiffrée. Le nombre de manches par partie est réglable en admin (défaut 5).
* **Mode (défi quotidien) :** une partie = N manches enchaînées (défaut 5) sur la **série déterministe du jour**, identique pour tous (graine de la date). **Une seule session par jour** : une fois terminée, on affiche le **nombre d'essais total** et on **ramène à l'accueil** (pas de Rejouer le même jour, message « reviens demain »). Un classement du jour comparant le nombre d'essais (le plus faible gagne) pourra être ajouté.
* **Persistance :** la partie en cours est sauvegardée côté client (identifiant de manche + essais déjà tentés + total) et restaurée via `GET /api/games/who-is-it/round/:id` ; un refresh retrouve le même Pokémon, l'étape et les essais. L'autocomplétion exclut les mauvaises réponses déjà soumises pour la silhouette courante et se réinitialise à la manche suivante.
* **Paramètres admin (`/admin/games/who-is-it`) :** `roundsCount` (défaut 5), `startCapital` (héritage, le score est en essais), `hintCosts` (coût par palier d'indice), `zoomStepPerMistake` (dézoom par erreur), `allowedGenerationsByLevel` (catalogue par niveau), angle et pas de rotation par niveau. Centralisés dans `game-config.ts`. Toute modification sera journalisée (audit admin).
* **Endpoints :** `POST /api/games/who-is-it/start` (démarre une manche, accepte `roundIndex`), `GET /api/games/who-is-it/round/:roundId` (état d'une manche), `POST /api/games/who-is-it/guess` (soumet une réponse), `POST /api/games/who-is-it/hint` (révèle l'indice du palier courant). `GET /api/pokemon/names` alimente l'autocomplétion.
* **Anti-Triche :** l'URL `/api/sprites/:sessionHash` ne révèle ni nom ni `pokedexId`. L'identité du Pokémon, l'état masqué et la validation vivent exclusivement côté serveur (state machine + Redis). Le client n'émet que des actions (`SUBMIT_GUESS`, `REVEAL_HINT`) et rend les états renvoyés. À la résolution, le serveur renvoie l'état final et le sprite couleur démasqué.

### 2. Poké-Motus (*Wordle Pokémon*)
* **Concept :** deviner le nom d'un Pokémon en un nombre d'essais dépendant du niveau (4 à 6), avec un retour coloré par lettre, à la Wordle.
* **Mot du jour :** **un seul mot par jour** (défi quotidien, série déterministe identique pour tous via la graine de la date). La cible est un Pokémon dont le nom (accents retirés, lettres A à Z uniquement, un seul mot) fait **entre 5 et 9 lettres**.
* **Indices de départ (selon le niveau) :** la **longueur** (nombre de cases) est toujours donnée. La **première lettre** n'est fournie qu'aux niveaux Facile et Moyen (champ serveur `firstLetter`, `null` sinon) : le client ne peut pas la deviner seul, et le reste du mot reste caché jusqu'à la fin.
* **Niveaux :** **Facile** (5 ou 6 lettres, 1re lettre donnée, 6 essais), **Moyen** (6 ou 7 lettres, 1re lettre donnée, 5 essais), **Difficile** (5 à 8 lettres, sans 1re lettre, 6 essais), **Extrême** (5 à 9 lettres, sans 1re lettre, 4 essais). Valeurs dans `game-config.ts` (`MOTUS_ADMIN_CONFIG`).
* **Saisie :**
  * La première case affiche la lettre donnée, fixe (non éditable). Le joueur tape les lettres suivantes. **Auto-soumission dès que la ligne est pleine** (la proposition envoyée inclut la première lettre).
  * La proposition doit **obligatoirement être un vrai Pokémon** de la même longueur (comparaison **sans accents**, lettres seules). Sinon la ligne est **rejetée sans consommer d'essai** (petite secousse) et le joueur corrige.
* **Code couleur (calculé côté serveur, gestion correcte des lettres en double) :**
  * **Vert :** lettre correcte et bien placée.
  * **Jaune/orange :** lettre présente dans le nom mais mal placée.
  * **Noir :** lettre absente du nom.
* **Clavier virtuel :** clavier à l'écran (AZERTY) dont les touches se colorent (vert/jaune/noir) selon les lettres déjà jouées.
* **Fin :** victoire si trouvé en 6 essais ou moins, sinon défaite (la réponse est alors révélée). Comme tous les jeux solo, **une seule session par jour** ; en fin de partie, retour à l'accueil.
* **Endpoints :** `POST /api/games/motus/start` (récupère le mot du jour), `GET /api/games/motus/round/:roundId` (état), `POST /api/games/motus/guess` (soumet une proposition).
* **Anti-Triche :** le mot mystère reste **exclusivement dans Redis** côté serveur jusqu'à la victoire ou l'épuisement des essais. Le client ne reçoit que la longueur, le patron de couleurs par tentative et le statut ; jamais le mot tant que la partie n'est pas finie. La validité d'une proposition (est-ce un Pokémon de la bonne longueur) est vérifiée côté serveur.
* **Paramètres admin (`/admin/games/motus`) :** `maxAttemptsByLevel`, `minLengthByLevel`, `maxLengthByLevel`, `provideFirstLetterByLevel`. Centralisés dans `game-config.ts`.

### 3. Plus ou Moins (*Duel de caractéristiques*)
* **Concept :** un **duel** par manche. Deux Pokémon (sprite + nom), une question sur une caractéristique. Le joueur clique sur celui qui a la **plus grande** valeur, ou parfois la **plus petite** : le sens recherché (plus ou moins) est signalé visuellement par un repère de couleur, pour lever toute ambiguïté.
* **Format :** **10 manches fixes** par partie, score = nombre de bonnes réponses. Défi quotidien (série déterministe identique pour tous, graine du jour), **une seule session par jour**, fin → retour à l'accueil.
* **Valeur variable à chaque manche :** la caractéristique change à chaque duel, parmi PV, Taille, Poids, Attaque, Défense, Vitesse et Ancienneté (numéro de Pokédex, le plus ancien = le plus petit numéro). Les deux Pokémon d'un duel ont des valeurs distinctes (pas d'égalité).
* **Niveaux (écart brut garanti entre les deux valeurs) :** **Facile** écart minimal de 45 points (ou 50 cm / 50 kg), **Moyen** écart entre 25 et 45 (mêmes stades d'évolution possibles), **Difficile** écart entre 10 et 25, **Extrême** écart inférieur ou égal à 9 (ex. 102 contre 100). Seuils par niveau dans `game-config.ts`.
* **Sprites :** affichés en clair (jeu non masqué) via l'endpoint public `GET /api/pokemon/:id/sprite` (le client n'appelle jamais Tyradex directement, cf. Règle 3 ; le backend proxie et met en cache).
* **Endpoints :** `POST /api/games/plus-minus/start` (duels du jour), `GET /api/games/plus-minus/round/:roundId` (état), `POST /api/games/plus-minus/choice` (soumet A ou B).
* **Anti-Triche :** les **valeurs exactes ne sont jamais envoyées avant le choix**. Le client ne reçoit que la question et les deux Pokémon (id, nom, URL de sprite). Le serveur (Redis) détient les valeurs et la bonne réponse, valide le choix, puis renvoie les deux valeurs révélées et la manche suivante.
* **Paramètres admin (`/admin/games/plus-minus`) :** `roundsCount` (défaut 10), `minDiffThresholdByLevel`, `maxDiffThresholdByLevel`, `enabledStatsList`. Centralisés dans `game-config.ts`.

### 4. L'Intrus (*Odd One Out*)
* **Concept :** plusieurs Pokémon sont présentés (4 à 6 selon le niveau). Tous sauf un partagent un **critère secret** ; le joueur identifie et sélectionne l'intrus.
* **Format :** défi quotidien, plusieurs grilles par jour (cible spec : 5 grilles ; l'implémentation actuelle en enchaîne 10, à réaligner). Le trait commun est **révélé** après la réponse (image du type, valeur de stat, ou sprite de méga-évolution), toujours en affichage progressif.
* **Règles (critère secret) :** **génération**, **type principal**, **seuil de statistique** (ex. « les 3 ont moins de 100 en Vitesse »), **stade / forme finale d'évolution**, **méga-évolution** (portée par la forme finale de la lignée, vérifiée via l'ETL). La méga se révèle avec le sprite de méga.
* **Niveaux :** **Facile** (4 Pokémon, comparaison Type ou Génération, aucun critère de stat, **indice explicite** dès le départ, ex. « Trouve celui qui n'est pas de type Eau »), **Moyen** (5 Pokémon, stat ou morphologie, **domaine indiqué**, ex. « L'un a moins de 80 en Vitesse »), **Difficile** (6 Pokémon, indice fourni **uniquement** si le critère est une stat, sinon aucun indice ; le backend garantit qu'aucune autre stat ne présente d'écart notable pour ne pas induire en erreur).
* **Moteur d'isolation :** le service vérifie par intersection que **seul le critère cible isole un unique Pokémon** dans la grille (pas d'ambiguïté possible entre plusieurs critères).
* **Sprites :** affichés en clair (les noms sont visibles, c'est le principe) via `GET /api/pokemon/:id/sprite`.
* **Endpoints :** `POST /api/games/intruder/start`, `GET /api/games/intruder/round/:roundId`, `POST /api/games/intruder/choice` (soumet le `pokemonId` choisi).
* **Anti-Triche :** le **critère secret et l'intrus ne sont jamais transmis** avant la réponse. Le client reçoit une grille anonyme (id, nom, sprite) ; règle, intrus et trait commun vivent en Redis et ne sont renvoyés qu'après le choix.
* **Paramètres admin (`/admin/games/intruder`) :** `gridSizeByLevel`, `statModeMinDiff`, `enableHintsByLevel`. Centralisés dans `game-config.ts`.

### 5. Trouve le shiny (et Trouve le non-shiny)
* **Concept :** plusieurs cartes affichent des Pokémon différents. En mode **Shiny**, un seul est sous sa forme chromatique (shiny), les autres sont normaux : trouver le shiny. En mode **Non-Shiny** (inversé), tous sont shiny sauf un normal : trouver celui qui ne l'est pas.
* **Format :** **5 manches par session**, **sessions distinctes par mode** (deux défis quotidiens indépendants, un statut par mode). Bascule flèche entre les deux modes dans le jeu, et carte bleue dédiée au mode inversé sur l'accueil.
* **Niveaux :** **Facile** 3 cartes, **Moyen** 4 cartes, **Difficile** 6 cartes. La difficulté vient du **nombre** de cartes.
* **Sprites obligatoirement chromatiques :** seuls les Pokémon dotés d'un sprite shiny sont éligibles (jamais un sprite normal montré comme shiny).
* **Endpoints :** `POST /api/games/shiny/start` (avec `mode`), `GET /api/games/shiny/round/:roundId`, `POST /api/games/shiny/choice` (slot), proxy vignette `GET /api/games/shiny/tile/:roundId/:round/:slot`.
* **Anti-Triche :** toutes les images passent par le **proxy opaque par slot** ; aucune mention « shiny » ou « regular » dans les URL ou le JSON. Les cartes étant des espèces différentes, la taille des octets ne trahit pas la réponse.
* **Paramètres admin (`/admin/games/shiny`) :** `roundsCount`, `gridSizeByLevel`.

### 6. Trouve le bon shiny
* **Concept :** toutes les cartes affichent **le même Pokémon shiny**. Toutes sauf une ont subi une **altération colorimétrique** (rotation de teinte). Le joueur repère l'unique sprite chromatique **officiel intact**. La couleur normale n'est **jamais** affichée.
* **Format :** **5 manches par jour**, un Pokémon distinct par manche. Écran de choix de niveau (défi quotidien par niveau).
* **Niveaux :** **Facile** 3 cartes (2 fausses, 1 vraie), **Moyen** 5 cartes, **Difficile** 6 cartes. **Décision :** l'altération reste **marquée à tous les niveaux** (teintes franches), la difficulté vient du nombre de cartes, pas de la subtilité (sinon les différences deviennent invisibles avec 5 ou 6 propositions).
* **Endpoints :** `POST /api/games/true-shiny/start` (avec `level`), `GET /api/games/true-shiny/round/:roundId`, `POST /api/games/true-shiny/choice` (slot), proxy vignette `GET /api/games/true-shiny/tile/:roundId/:round/:slot`.
* **Anti-Triche :** **aucun filtre CSS client** (`filter: hue-rotate` proscrit, l'inspection DOM révélerait la carte intacte). L'altération est **générée par sharp côté serveur** dans le proxy ; chaque slot renvoie un flux binaire déjà modifié. Toutes les vignettes, **intacte comprise**, passent par le même encodeur sharp pour que l'intacte ne soit pas repérable par la taille des octets.
* **Paramètres admin (`/admin/games/true-shiny`) :** `gridSizeByLevel`, `hueShiftMinByLevel`, `hueShiftMaxByLevel`.

### 7. La Juste Stat (façon *Le Juste Prix*)
* **Concept :** un Pokémon (visuel + nom) est présenté, le joueur devine la **valeur exacte** d'une caractéristique imposée (PV, Attaque, Défense, Attaque Spéciale, Défense Spéciale, Vitesse, Taille en cm, Poids en kg). À chaque proposition, le serveur indique **PLUS HAUT** (flèche verte) ou **PLUS BAS** (flèche rouge), ou correct.
* **Format :** **3 manches par jour**, mode unique, chrono de **20 secondes** par manche (temps écoulé = manche perdue, valeur révélée). Le champ garde le focus pour saisir à la suite.
* **Variété intra-session :** les 3 manches varient le Pokémon (3 distincts) et la stat tirée (3 distinctes), pour ne jamais deviner deux fois la même stat ni le même Pokémon dans une session.
* **Endpoints :** `POST /api/games/just-stat/start`, `GET /api/games/just-stat/round/:roundId`, `POST /api/games/just-stat/guess` (`{ guessValue }` renvoie `{ direction: 'HIGHER' | 'LOWER' | 'CORRECT', attemptsRemaining, ... }`), `POST /api/games/just-stat/timeout`.
* **Anti-Triche :** la valeur exacte est conservée **en Redis** ; le client ne reçoit que le libellé de la stat, des bornes indicatives, la direction et le nombre d'essais restants. La valeur n'est révélée qu'à la fin de la manche.
* **Paramètres admin (`/admin/games/just-stat`) :** `roundsCount` (défaut 3), `timeLimitSecondsByLevel`, `allowedStatsByLevel`. Centralisés dans `game-config.ts` (`JUST_STAT_CONFIG`).

### 8. Qui est-ce ? (*Poké-Guess / 20 Questions*)
* **Concept :** Jeu de déduction tactique en solo (contre une IA de filtrage) ou en multijoueur (1v1).
* **Mécanique :**
  * Chaque joueur dispose d'une grille de 24 Pokémon. Le serveur assigne secrètement un Pokémon cible à chaque joueur.
  * À chaque tour, le joueur pose une question fermée (Oui/Non) sur les attributs : *"Est-il de type Vol ?"*, *"Pèse-t-il plus de 50 kg ?"*, *"Est-ce un Pokémon légendaire ?"*, *"Est-il de génération impaire ?"*.
  * Le serveur répond par Oui ou Non selon le Pokémon cible de l'adversaire.
  * Le joueur retourne automatiquement ou manuellement les cartes éliminées.
  * Le premier joueur qui devine exactement le Pokémon secret adverse gagne la partie.
* **Anti-Triche :** En multijoueur 1v1, l'identité du Pokémon secret de l'Adversaire A est stockée exclusivement sur le serveur. L'Adversaire B n'y a jamais accès.

### Jeu parallèle : Easter Eggs (collection cachée)
* **Concept :** de petites silhouettes de Pokémon sont cachées à des endroits précis de l'interface (hors arène de jeu, pour ne jamais gêner une manche en cours). C'est un jeu parallèle de collection, en fond permanent de l'expérience.
* **Mécanique :**
  * Le joueur repère une silhouette cachée et clique dessus pour la collecter.
  * Le Pokémon collecté s'ajoute à son **Pokédex personnel** (la collection accessible via l'icône Pokédex du header).
  * Les apparitions (quels emplacements, quel Pokémon, quand) sont décidées et validées **côté serveur** (autorité serveur, cf. Règle 4), avec un jeton d'apparition unique. La collecte est idempotente : recliquer ne collecte pas deux fois.
* **Anti-Triche :** l'identité du Pokémon derrière la silhouette n'est pas exposée avant la collecte (cf. Règle 2). La silhouette est servie par le même proxy masqué que les jeux (`/api/sprites/:sessionHash`). Le serveur empêche la collecte scriptée en masse (jeton lié à l'apparition, vérification d'éligibilité côté serveur).
* **Pokédex personnel :** la collection est propre à chaque utilisateur. Le Pokédex distingue les Pokémon collectés via easter eggs des autres entrées éventuelles, et reste une vue simple et lisible (cf. cap dialé sur la simplicité).

---

## 6. Guide pour les Procédures et Modifications
1. **Modifications BDD :** Toujours éditer `apps/api/prisma/schema.prisma` en premier et justifier les changements.
2. **Nouveau Code :** Toujours vérifier `npm run typecheck` dans l'ensemble du monorepo avant d'achever une tâche. Zéro erreur tolérée.
3. **Sécurité :** Lors de l'ajout d'une API de jeu, se poser systématiquement la question : *"Un joueur avec l'onglet Réseau (F12) ouvert peut-il lire la réponse ou deviner l'issue ?"*. Si oui, appliquer le Data Masking.
4. **Tests Backend Obligatoires :** Pour chaque service ou fonctionnalité du backend (`*.service.ts`, contrôleur critique), créer et maintenir un fichier de test unitaire (`*.spec.ts`) exécutable via Jest pour valider rigoureusement le comportement et l'intégrité anti-triche.
5. **Interdiction de pousser du code en erreur (règle non négociable) :** aucun `git push` ne doit partir si une seule de ces étapes échoue : typecheck (`tsc --noEmit`), lint (ESLint, zéro erreur), tests (Jest, tous au vert), et présence d'un fichier de test par service. Ne jamais contourner le hook (`--no-verify`) sans accord explicite du porteur du projet.
6. **Tests présents et exécutés :** chaque service doit avoir son fichier de test écrit ET passant. Le script `npm run check:specs` vérifie la présence d'un `*.service.spec.ts` par service (les wrappers d'infrastructure Prisma et Redis sont exclus). Un service sans test, ou un test qui échoue, bloque le push.

### Garde-fou automatisé (Husky)
* Un hook **pre-push** (Husky, dans `.husky/pre-push`) exécute `npm run verify` à chaque `git push`.
* `npm run verify` enchaîne, dans l'ordre : `typecheck` puis `lint` puis `test` puis `check:specs`. Le push n'a lieu que si tout passe.
* Les scripts racine associés : `lint` (ESLint flat config, `no-explicit-any` en erreur conforme à la Règle 1), `test` (Jest sur les workspaces), `check:specs` (présence des fichiers de test).

---

## 7. Méthode de Développement et Feuille de Route

### Authentification (décision actée)
* **JWT access + refresh.** Le token d'accès est court et vit en mémoire côté client (jamais en localStorage). Le refresh token est stocké en **cookie httpOnly** (non lisible en JS, illisible via F12), avec rotation. Cohérent avec la culture anti-triche du projet.

### Couverture des données (décision actée)
* **Toutes les générations dès la v1.** L'ETL Tyradex aspire le catalogue complet. La **sélection par génération** côté joueur est prévue, mais plus tard (pas en v1).

### Ordre de construction (décision actée)
* On développe **jeu par jeu, backend d'abord** : pour chaque jeu, on écrit le back (service, state machine serveur, API masquée) et on valide ses tests Jest (verts, zéro erreur typecheck) avant de passer au jeu suivant.
* Une fois **tous les backends terminés et testés**, on attaque le **front** (apps/web) puis les **tests front** (Vitest), jeu par jeu également.

### Feuille de route des phases
1. **Quel est ce Pokémon** (solo) : back + tests. Valide la chaîne complète (ETL, masquage sprite via `sessionHash`, state machine solo, anti-triche).
2. **Poké-Motus** (solo) : back + tests.
3. **Plus ou Moins** (dichotomie et duel) : back + tests.
4. **L'Intrus** : back + tests.
5. **Easter eggs** (jeu parallèle de collection) : back + tests. Apparitions et collecte validées serveur, alimentation du Pokédex personnel, silhouettes via le proxy masqué (voir section 5).
6. **Qui est-ce ?** (multijoueur 1v1, le seul multi) : back + tests. Dernier, car il introduit le temps réel Socket.io et le matchmaking.
7. **Front complet + tests front** une fois tous les back livrés.

### Évolution de la méthode (au fil de l'eau)
En pratique, on livre désormais **chaque jeu de bout en bout** (backend puis front) plutôt que tous les backends d'abord, chaque jeu étant validé par `npm run verify`, puis commité et poussé.

### État d'avancement
* **Jeux livrés (back + front, testés) :** Quel est ce Pokémon (silhouette), Poké-Motus, Plus ou Moins, L'Intrus, Trouve le shiny / non-shiny, Le Bon Shiny, La Juste Stat. Chacun : état serveur en Redis, anti-triche, événement d'audit `game.round.completed`, tests Jest.
* **Accueil :** cartes des jeux (icônes PNG), carte shiny à bascule (Shiny / Non-Shiny), badges de statut quotidien.
* **Données enrichies (ETL) :** colonnes ajoutées sur `Pokemon` pour L'Intrus et Le Bon Shiny (`evolutionStage`, `isFinalEvolution`, `hasMega`, sprites de méga) ; sprite shiny requis pour les jeux chromatiques.
* **Anti-répétition :** livrée et branchée dans les 7 jeux solo (`DailyPick`, `HistoryService`). Chaque jeu exclut au tirage les Pokémon sortis sur une fenêtre par jeu (`ANTI_REPEAT_WINDOW_DAYS`, calculée pool / tirés-par-jour), avec repli sans historique si le pool devient insuffisant, puis enregistre le tirage du jour (idempotent via `hasPicksFor`). Scope = niveau pour Silhouette/Motus, mode pour Shiny, global sinon. Dimensions secondaires (stat) exclues 1 jour (`ANTI_REPEAT_DETAIL_WINDOW_DAYS`).
* **Niveaux de difficulté :** livrés pour tous les jeux solo à niveaux. Le Bon Shiny (3 niveaux), Silhouette et Motus (4 niveaux), Plus ou Moins (4 niveaux, bandes d'écart + dédup inter-niveaux), Trouve le shiny / non-shiny (réaligné 5 manches, 3 niveaux par nombre de cartes + dédup inter-niveaux par mode), L'Intrus (5 grilles, 3 niveaux : taille de grille + règles autorisées + indice pré-réponse par niveau + dédup inter-niveaux). L'écran de choix de niveau partagé (`LevelSelectScreen`) est en place. La Juste Stat reste volontairement en mode unique.
* **Non-répétition entre niveaux (décision actée) :** pour les jeux à niveaux, le tirage du jour construit tous les niveaux dans un ordre fixe avec un même RNG et un ensemble d'exclusion partagé, de sorte qu'un même Pokémon ne sort jamais dans deux niveaux le même jour. Livré pour tous les jeux à niveaux (`getDailyPlan` pour Plus ou Moins, Trouve le shiny, L'Intrus, Le Bon Shiny ; `buildDailySeriesAll` pour Silhouette ; `getDailyPlan` mot par mot pour Motus).
* **Admin (livré) :** accès protégé (`AdminGuard`, rôle ADMIN), écran `/admin` : dashboard (stats + historique des parties), gestion des utilisateurs (infos, parties jouées, temps joué, détail), et configuration dynamique des jeux (source de vérité unique en base, édition à chaud).
* **Comptes / persistance (livré) :** résultats quotidiens par compte (`DailyResult`), verrou serveur de l'unicité du jour, historique joueur (`/historique`), classements du jour par jeu × niveau (`/classements`), quêtes du jour.
* **Reste à construire :** Qui est-ce (multi 1v1, Socket.io), Easter eggs + Pokédex personnel.
* **Idée notée (à faire plus tard) : panneau de quêtes du jour.** Une petite icône repliable sur la gauche de l'écran de jeu déroule la liste des jeux du jour, accomplis et restants, avec une coche de validation quand un jeu est terminé à 100 % (tous ses modes et niveaux) et une validation globale quand toute la journée est complétée. Objectif : voir en un coup d'oeil ce qui reste pour ne rater aucun jeu.

---

## 8. Données, ETL et Sprites (spécifications techniques)

### 8.1 Modèle de données Pokémon (Prisma)
Le modèle persiste tout ce que les jeux consomment, importé depuis Tyradex. Toute évolution du schéma passe par une migration versionnée (jamais de `db push` sauvage).

* **`Pokemon`** : `id` (cuid, PK interne), `pokedexId` (Int, unique, identifiant Pokédex national), `generation` (Int), `category` (String, ex. catégorie d'espèce), `nameFr`, `nameEn`, `nameJp` (String, FR obligatoire, EN persisté, JP optionnel), `heightM` (Decimal, mètres, parsé depuis Tyradex), `weightKg` (Decimal, kilos, parsé), `catchRate` (Int nullable), `isLegendary` (Boolean, voir note ci-dessous), `createdAt`, `updatedAt`.
* **Statistiques** (utilisées par Plus ou Moins et Qui est-ce) : colonnes sur `Pokemon`, `statHp`, `statAtk`, `statDef`, `statSpeAtk`, `statSpeDef`, `statVit` (Int). Jamais transmises au client avant résolution de la manche (cf. Règle 2).
* **`Type`** (table de référence) : `id`, `nameFr`, `nameEn`, `imagePath`. **`PokemonType`** (jointure) : `pokemonId`, `typeId`, `slot` (Int, 1 ou 2). Un Pokémon a un ou deux types.
* **`PokemonEvolution`** : `id`, `pokemonId`, `relatedPokedexId` (Int), `kind` (String : `PRE`, `NEXT`, `MEGA`), `condition` (String nullable). Permet de reconstituer la chaîne et son nombre de stades (utile pour L'Intrus).
* **`PokemonTalent`** : `id`, `pokemonId`, `name` (String), `isHidden` (Boolean).
* **`PokemonResistance`** : `id`, `pokemonId`, `typeName` (String), `multiplier` (Decimal). Persisté pour usage futur (questions de Qui est-ce, variantes).
* **Sprites** : chemins de stockage local sur `Pokemon`, `spriteRegularPath`, `spriteShinyPath`, `silhouettePath` (String). Aucune URL externe n'est exposée au client (cf. section 8.3).
* **Pokédex personnel** : **`UserPokedexEntry`** : `id`, `userId`, `pokemonId`, `source` (String, ex. `EASTER_EGG`), `collectedAt`. Unicité sur (`userId`, `pokemonId`, `source`) pour rester idempotent.
* **Note `isLegendary` :** Tyradex n'expose pas de drapeau légendaire fiable. Ce champ est donc alimenté par une **liste curatée maintenue dans le projet** (seed), appliquée après l'import, et non par l'ETL brut. À documenter et tenir à jour.

### 8.2 ETL Tyradex
* **Source :** `https://tyradex.app/api/v1/pokemon` (catalogue complet). Le client ne l'appelle jamais (cf. Règle 3) : seul le backend extrait.
* **Couverture :** **toutes les générations** dès la v1. La sélection par génération côté joueur viendra plus tard.
* **Déclenchement :** **commande manuelle** `npm run etl:pokemon` (workspace `apps/api`) **et cron quotidien** (une fois par jour) pour rafraîchir.
* **Idempotence :** upsert sur `pokedexId`. Une réexécution ne crée jamais de doublon et met à jour les champs existants.
* **Transformations :** parser `height` (ex. `"0,7 m"`) en Decimal mètres et `weight` (ex. `"6 kg"`) en Decimal kilos ; mapper types, stats, talents, résistances et évolutions ; persister FR + EN (JP si disponible).
* **Sprites :** l'ETL télécharge les sprites (normal et shiny) vers le **stockage local** et **pré-génère la silhouette** (noir absolu) à l'ingestion. Les métadonnées EXIF sont supprimées. Application de la liste curatée `isLegendary` en fin d'import.
* **Robustesse :** log clair (compte importé, ignoré, en erreur), tolérant aux entrées partielles de Tyradex, jamais bloquant pour le reste du catalogue.

### 8.3 Proxy de sprites et masquage (anti-triche)
* **Stockage local :** sprites originaux et silhouette pré-générée stockés localement (volume ou filesystem de `apps/api`), référencés par chemin en base. Aucune image n'est jamais appelée par son nom ou son `pokedexId` réel côté client.
* **Endpoint unique :** `GET /api/sprites/:sessionHash`. Le `sessionHash` est un **UUID temporaire** généré par la state machine au début d'une manche (ou d'une apparition d'easter egg), stocké dans **Redis** avec un TTL aligné sur la durée de vie de la manche, et mappé au `pokemonId` plus l'état courant.
* **Masquage piloté serveur :** tant que la manche est active, le proxy sert la **silhouette** (noir absolu). Après résolution (réponse soumise ou timeout), il sert le **sprite couleur**. L'état masqué/démasqué vit dans Redis, jamais côté client.
* **En-têtes :** réponses masquées non cacheables (`Cache-Control: no-store`) pour qu'un sprite démasqué ne fuite pas via le cache. Flux binaire sans EXIF.
* **Réutilisation :** le même mécanisme sert les silhouettes des easter eggs, avec la même garantie d'absence de fuite avant collecte.
