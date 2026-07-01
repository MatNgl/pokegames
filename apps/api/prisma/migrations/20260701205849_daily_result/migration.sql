-- CreateTable
CREATE TABLE "DailyResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "dayDate" DATE NOT NULL,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER,
    "score" INTEGER,
    "correctCount" INTEGER,
    "totalRounds" INTEGER,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyResult_gameType_scope_dayDate_idx" ON "DailyResult"("gameType", "scope", "dayDate");

-- CreateIndex
CREATE INDEX "DailyResult_userId_dayDate_idx" ON "DailyResult"("userId", "dayDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyResult_userId_gameType_scope_dayDate_key" ON "DailyResult"("userId", "gameType", "scope", "dayDate");

-- AddForeignKey
ALTER TABLE "DailyResult" ADD CONSTRAINT "DailyResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
