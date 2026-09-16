-- Cifrado de campos sensibles en reposo (seccion 8.4).
-- La C.I. pasa a guardarse cifrada, por lo que su unicidad se traslada a una
-- huella HMAC determinista que permite buscarla sin descifrar la tabla.

-- 1) La unicidad ya no puede estar sobre el valor cifrado
DROP INDEX IF EXISTS "employees_ci_key";

-- 2) Huella de la C.I.
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "ci_huella" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "employees_ci_huella_key" ON "employees"("ci_huella");
