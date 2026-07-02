-- Retrait complet de l'Elo (aucun classement sur le mode multi).
ALTER TABLE "User" DROP COLUMN "eloScore";
