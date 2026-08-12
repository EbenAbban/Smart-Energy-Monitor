-- CreateTable
CREATE TABLE "Appliance" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "powerRating" DOUBLE PRECISION NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "relayNumber" INTEGER NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'plug',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyReading" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "energyUsed" DOUBLE PRECISION NOT NULL,
    "voltage" DOUBLE PRECISION NOT NULL DEFAULT 120.0,
    "current" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "power" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "frequency" DOUBLE PRECISION,
    "powerFactor" DOUBLE PRECISION,
    "applianceId" INTEGER NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alert" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EnergyReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "maximumEnergy" DOUBLE PRECISION NOT NULL,
    "currentUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnergyReading_applianceId_idx" ON "EnergyReading"("applianceId");

-- CreateIndex
CREATE INDEX "EnergyReading_timestamp_idx" ON "EnergyReading"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_month_year_key" ON "Budget"("month", "year");

-- AddForeignKey
ALTER TABLE "EnergyReading" ADD CONSTRAINT "EnergyReading_applianceId_fkey" FOREIGN KEY ("applianceId") REFERENCES "Appliance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
