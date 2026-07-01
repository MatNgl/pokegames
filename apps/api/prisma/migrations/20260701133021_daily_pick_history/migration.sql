-- CreateTable
CREATE TABLE "DailyPick" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "pickDate" DATE NOT NULL,
    "pokemonId" INTEGER,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyPick_game_scope_pickDate_idx" ON "DailyPick"("game", "scope", "pickDate");

-- CreateIndex
CREATE INDEX "DailyPick_game_scope_pokemonId_idx" ON "DailyPick"("game", "scope", "pokemonId");

-- CreateIndex
CREATE INDEX "DailyPick_game_scope_detail_idx" ON "DailyPick"("game", "scope", "detail");
