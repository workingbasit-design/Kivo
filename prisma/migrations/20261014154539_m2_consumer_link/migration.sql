-- CreateTable
CREATE TABLE "CustomerLink" (
    "id" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerLink_customerUserId_idx" ON "CustomerLink"("customerUserId");

-- CreateIndex
CREATE INDEX "CustomerLink_customerId_idx" ON "CustomerLink"("customerId");

-- CreateIndex
CREATE INDEX "CustomerLink_businessId_idx" ON "CustomerLink"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLink_customerUserId_customerId_businessId_key" ON "CustomerLink"("customerUserId", "customerId", "businessId");

-- AddForeignKey
ALTER TABLE "CustomerLink" ADD CONSTRAINT "CustomerLink_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLink" ADD CONSTRAINT "CustomerLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLink" ADD CONSTRAINT "CustomerLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
