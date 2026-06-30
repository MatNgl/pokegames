-- CreateTable
CREATE TABLE "Pokemon" (
    "id" INTEGER NOT NULL,
    "pokedexId" INTEGER NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "category" TEXT,
    "generation" INTEGER NOT NULL,
    "spriteRegular" TEXT NOT NULL,
    "spriteShiny" TEXT,
    "statsHp" INTEGER NOT NULL,
    "statsAtk" INTEGER NOT NULL,
    "statsDef" INTEGER NOT NULL,
    "statsSpeAtk" INTEGER NOT NULL,
    "statsSpeDef" INTEGER NOT NULL,
    "statsSpeed" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Type" (
    "id" SERIAL NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "Type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonType" (
    "pokemonId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PokemonType_pkey" PRIMARY KEY ("pokemonId","typeId")
);

-- CreateTable
CREATE TABLE "Evolution" (
    "id" SERIAL NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "targetId" INTEGER NOT NULL,
    "condition" TEXT,

    CONSTRAINT "Evolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "eloScore" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "isMulti" BOOLEAN NOT NULL DEFAULT false,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAuditLog" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "userId" TEXT,
    "targetPokemonId" INTEGER NOT NULL,
    "targetNameFr" TEXT NOT NULL,
    "userGuess" TEXT,
    "isSuccess" BOOLEAN NOT NULL,
    "scoreEarned" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL,
    "hintsUsedCount" INTEGER NOT NULL DEFAULT 0,
    "isMultiplayer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pokemon_pokedexId_key" ON "Pokemon"("pokedexId");

-- CreateIndex
CREATE INDEX "Pokemon_generation_idx" ON "Pokemon"("generation");

-- CreateIndex
CREATE INDEX "Pokemon_nameFr_idx" ON "Pokemon"("nameFr");

-- CreateIndex
CREATE UNIQUE INDEX "Type_nameFr_key" ON "Type"("nameFr");

-- CreateIndex
CREATE UNIQUE INDEX "Type_nameEn_key" ON "Type"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "GameAuditLog_roundId_key" ON "GameAuditLog"("roundId");

-- CreateIndex
CREATE INDEX "GameAuditLog_gameType_isSuccess_idx" ON "GameAuditLog"("gameType", "isSuccess");

-- CreateIndex
CREATE INDEX "GameAuditLog_createdAt_idx" ON "GameAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PokemonType" ADD CONSTRAINT "PokemonType_pokemonId_fkey" FOREIGN KEY ("pokemonId") REFERENCES "Pokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonType" ADD CONSTRAINT "PokemonType_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolution" ADD CONSTRAINT "Evolution_pokemonId_fkey" FOREIGN KEY ("pokemonId") REFERENCES "Pokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolution" ADD CONSTRAINT "Evolution_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Pokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
