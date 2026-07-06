-- DropForeignKey
ALTER TABLE "DailyResult" DROP CONSTRAINT "DailyResult_userId_fkey";

-- AlterTable : userId devient optionnel, ajout de l'identite invite.
ALTER TABLE "DailyResult" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "DailyResult" ADD COLUMN "guestId" TEXT;
ALTER TABLE "DailyResult" ADD COLUMN "guestName" TEXT;

-- CreateIndex : unicite du defi du jour par invite (nulls distincts cote Postgres).
CREATE UNIQUE INDEX "DailyResult_guestId_gameType_scope_dayDate_key" ON "DailyResult"("guestId", "gameType", "scope", "dayDate");

-- AddForeignKey
ALTER TABLE "DailyResult" ADD CONSTRAINT "DailyResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Correction des anciennes lignes Silhouette (WHO_IS_IT) enregistrees avec un score au lieu du
-- nombre d'essais : on ne peut pas reconstituer les essais, on efface donc le score pour ne plus
-- afficher "X pts". Le classement quotidien affichera ces lignes comme "Reussi".
UPDATE "DailyResult" SET "score" = NULL WHERE "gameType" = 'WHO_IS_IT' AND "attempts" IS NULL;
