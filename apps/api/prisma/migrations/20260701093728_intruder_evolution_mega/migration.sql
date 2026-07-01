-- AlterTable
ALTER TABLE "Pokemon" ADD COLUMN     "evolutionStage" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "hasMega" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFinalEvolution" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "megaSpriteRegular" TEXT,
ADD COLUMN     "megaSpriteShiny" TEXT;
