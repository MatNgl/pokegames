-- CreateTable
CREATE TABLE "UserPokedexEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'EASTER_EGG',
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPokedexEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokedexSpawn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayDate" DATE NOT NULL,
    "zone" TEXT NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "collected" BOOLEAN NOT NULL DEFAULT false,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PokedexSpawn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPokedexEntry_userId_idx" ON "UserPokedexEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPokedexEntry_userId_pokemonId_source_key" ON "UserPokedexEntry"("userId", "pokemonId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "PokedexSpawn_token_key" ON "PokedexSpawn"("token");

-- CreateIndex
CREATE INDEX "PokedexSpawn_userId_dayDate_idx" ON "PokedexSpawn"("userId", "dayDate");

-- CreateIndex
CREATE UNIQUE INDEX "PokedexSpawn_userId_dayDate_zone_key" ON "PokedexSpawn"("userId", "dayDate", "zone");

-- AddForeignKey
ALTER TABLE "UserPokedexEntry" ADD CONSTRAINT "UserPokedexEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokedexSpawn" ADD CONSTRAINT "PokedexSpawn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
