-- AlterEnum
BEGIN;
CREATE TYPE "CategoriaBoletim_new" AS ENUM ('Oficial', 'Regulamento', 'Resultados', 'Convocacao', 'ComunicadoErrata');
ALTER TABLE "Boletim" ALTER COLUMN "categoria" TYPE "CategoriaBoletim_new" USING ("categoria"::text::"CategoriaBoletim_new");
ALTER TYPE "CategoriaBoletim" RENAME TO "CategoriaBoletim_old";
ALTER TYPE "CategoriaBoletim_new" RENAME TO "CategoriaBoletim";
DROP TYPE "CategoriaBoletim_old";
COMMIT;
