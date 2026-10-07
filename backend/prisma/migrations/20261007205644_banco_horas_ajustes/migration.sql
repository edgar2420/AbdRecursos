-- CreateTable
CREATE TABLE "banco_horas_ajustes" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "minutos" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banco_horas_ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banco_horas_ajustes_employee_id_idx" ON "banco_horas_ajustes"("employee_id");

-- AddForeignKey
ALTER TABLE "banco_horas_ajustes" ADD CONSTRAINT "banco_horas_ajustes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
