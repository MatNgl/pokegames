-- CreateTable
CREATE TABLE "AdminConfigLog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'UPDATE',
    "adminId" TEXT,
    "adminName" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminConfigLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminConfigLog_key_createdAt_idx" ON "AdminConfigLog"("key", "createdAt");

-- CreateIndex
CREATE INDEX "AdminConfigLog_createdAt_idx" ON "AdminConfigLog"("createdAt");
