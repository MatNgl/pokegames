# PokéGames

Mini-jeux Pokémon quotidiens (façon Pokédle), en monorepo TypeScript.

- **Backend** : NestJS + Prisma + PostgreSQL + Redis (`apps/api`)
- **Frontend** : React + Vite + Tailwind CSS v4 (`apps/web`)
- **Contrats partagés** : types TypeScript (`packages/shared-types`)
- **Référence d'architecture** : voir `claude.md` (règles, anti-triche, specs des jeux). Ce fichier fait foi.

Jeux disponibles : **Quel est ce Pokémon ?** (silhouette) et **Poké-Motus** (Wordle), tous deux en défi quotidien.

---

## Prérequis

- **Node.js 20+** et **npm**
- **Docker** + **Docker Compose** (pour PostgreSQL et Redis)
- **Git**

---

## Installation (première fois sur une nouvelle machine)

### 1. Cloner et installer

```bash
git clone https://github.com/MatNgl/pokegames.git
cd pokegames
npm install
```

`npm install` installe tous les workspaces et met en place les hooks Git (Husky).

### 2. Variables d'environnement

Le backend et Prisma lisent un fichier `.env` **dans `apps/api`**. Copie le modèle :

```bash
cp .env.example apps/api/.env
```

Contenu attendu (`apps/api/.env`) :

```dotenv
DATABASE_URL="postgresql://pokegames:pokegames_secret_password@localhost:5432/pokegames_db?schema=public"
REDIS_HOST="localhost"
REDIS_PORT=6379
PORT=3001
CORS_ORIGIN="http://localhost:5173"
# Recommandé (sinon un secret de repli de dev est utilisé) :
JWT_SECRET="un-secret-local-quelconque"
```

> Le frontend lit `VITE_API_URL` (défaut `http://localhost:3001/api`) : rien à configurer en local.

### 3. Démarrer la base et le cache (Docker)

```bash
docker compose up -d
```

Lance PostgreSQL (port **5432**) et Redis (port **6379**). Les données Postgres persistent dans un volume Docker, donc elles survivent à un redémarrage des conteneurs.

### 4. Préparer la base de données (Prisma)

```bash
npm run prisma:generate -w apps/api
npm run prisma:migrate  -w apps/api -- --name init
```

`prisma:migrate` applique les migrations versionnées et crée le schéma. (Sur une base déjà migrée, `prisma migrate dev` ne fait rien de plus.)

### 5. Remplir le Pokédex (ETL Tyradex)

Démarre d'abord l'API (étape suivante), puis lance la synchronisation **une fois** :

```bash
# bash / Linux / macOS
curl -X POST http://localhost:3001/api/etl/sync
```

```powershell
# Windows PowerShell (curl y est un alias d'Invoke-WebRequest)
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/etl/sync
```

Sans cette étape, les jeux renvoient « Aucun Pokémon disponible » (la base est vide). L'ETL importe ~1025 Pokémon depuis `https://tyradex.app`.

---

## Lancer le projet (à chaque session de dev)

Deux terminaux :

```bash
# Terminal A — backend  ->  http://localhost:3001/api
npm run start:dev -w apps/api

# Terminal B — frontend ->  http://localhost:5173
npm run dev -w apps/web
```

Puis ouvre `http://localhost:5173`.

---

## Qualité et garde-fou

Avant chaque `git push`, un hook **pre-push** (Husky) exécute :

```bash
npm run verify
```

qui enchaîne **typecheck → lint (ESLint) → tests (Jest) → présence des fichiers de test**. Un push échoue si une étape échoue (ne jamais contourner avec `--no-verify` sans raison).

Commandes utiles :

```bash
npm run typecheck   # tsc sur tous les workspaces
npm run lint        # ESLint (zéro any, etc.)
npm run test        # tests Jest du backend
npm run build       # build de tous les workspaces
```

---

## Structure

```
pokegames/
  apps/
    api/            Backend NestJS (jeux, ETL, auth, proxy de sprites)
      prisma/       schema.prisma + migrations
    web/            Frontend React + Vite
  packages/
    shared-types/   Types partagés API <-> Front (build vers dist/)
  claude.md         Contrat d'architecture (règles, anti-triche, specs)
  docker-compose.yml
```

---

## Notes utiles

- **Défi quotidien** : chaque jeu solo est jouable une fois par jour (suivi côté client via `localStorage`). Pour rejouer pendant le dev sans attendre le lendemain, vide les clés `pokegames:*` du Local Storage (DevTools → Application → Local Storage).
- **Conteneurs arrêtés** : si l'API renvoie une erreur de connexion à la base, relance `docker compose up -d`.
- **`packages/shared-types`** est compilé vers `dist/` et `npm run verify` le reconstruit automatiquement ; après une modification manuelle des types, lance `npm run build -w @pokegames/shared-types` si besoin.
- **Reset complet de la base** (efface les données) : `docker compose down -v` puis reprendre aux étapes 3 à 5.
