# Déploiement en production

Serveur : `root@serveur-perso`, projet dans `/var/www/pokegames`.
Monorepo npm workspaces : `packages/shared-types`, `apps/api` (NestJS + Prisma), `apps/web` (Vite).

Points importants :
- `shared-types` doit être bâti **avant** le web. Le build du **backend le reconstruit automatiquement** (via `prebuild`), mais le build du **web ne le fait pas** : on le rebuild à la main pour un déploiement frontend seul.
- Prisma est dans `apps/api` (schéma `apps/api/prisma/schema.prisma`) : les commandes Prisma se lancent depuis ce dossier.
- Le frontend est servi en statique (`apps/web/dist`) : **aucun redémarrage** après un build web, nginx sert directement les nouveaux fichiers.
- Ces commandes supposent **aucune modification locale non commitée** sur le serveur (pas de `git stash`). Voir la note en bas si `git pull` refuse.

---

## 1. Frontend seul (changement uniquement dans `apps/web`)

```bash
cd /var/www/pokegames && git pull && npm run build -w @pokegames/shared-types && npm run build -w @pokegames/web
```

## 2. Backend + Frontend (sans migration de base)

```bash
cd /var/www/pokegames && git pull && npm install && npm run build -w @pokegames/api && pm2 restart all && npm run build -w @pokegames/web
```

## 3. Backend + Frontend AVEC migration de base

```bash
cd /var/www/pokegames && git pull && npm install && ( cd apps/api && npx prisma migrate deploy && npx prisma generate ) && npm run build -w @pokegames/api && pm2 restart all && npm run build -w @pokegames/web
```

---

## Référencement : configuration nginx requise

Le build génère un fichier HTML **par route publique** (`dist/motus/index.html`, `dist/jouer/index.html`...) contenant les métadonnées et le contenu textuel de la page. C'est ce que lisent les moteurs de recherche et les robots IA, qui n'exécutent pas JavaScript.

Pour que ces fichiers soient réellement servis, nginx doit tenter le dossier **avant** de retomber sur l'index :

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

L'ordre compte : `$uri/` résout `/motus` vers `dist/motus/index.html`. Sans cette étape, toutes les routes renverraient l'accueil et le prerendu ne servirait à rien.

Sont aussi générés à la racine : `robots.txt` et `sitemap.xml` (12 URLs indexables).

Le domaine de production est défini par la constante `SITE_URL` dans `apps/web/src/lib/seo/site-meta.ts` (URL canoniques, Open Graph, sitemap). Une seule ligne à changer en cas de changement de domaine, puis rebuild.

L'image de partage (`public/og-image.png`) se régénère avec :
```bash
cd /var/www/pokegames/apps/web && node scripts/generate-og-image.mjs
```

## Notes

- **`pm2 restart all`** redémarre tous les process PM2 du serveur (redémarre l'API NestJS). Si d'autres projets tournent en PM2, cible plutôt le process PokéGames : `pm2 list` puis `pm2 restart <nom-ou-id>`.
- **`.env` non versionné** : `git pull` n'y touche pas (identifiants BDD, `JWT_SECRET`, Redis...).
- **`git pull` refuse à cause de modifs locales ?** Deux options :
  - annuler les modifs locales : `git checkout -- .` puis relancer ;
  - ou les mettre de côté : `git stash` puis relancer (et `git stash pop` si tu veux les récupérer).
- **Rafraîchir les données Pokémon (ETL Tyradex)**, si besoin après coup :
  ```bash
  cd /var/www/pokegames/apps/api && npm run etl
  ```
  (nécessite un build API à jour, l'ETL tourne sur `dist/`).
- **Vérifier que l'API tourne** après un déploiement : `pm2 logs` (ou `pm2 status`).
