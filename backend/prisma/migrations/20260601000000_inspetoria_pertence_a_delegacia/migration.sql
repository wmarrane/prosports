-- Inspetoria agora pertence a uma Delegacia (NOT NULL).
-- Em prod (06/2026) ainda não há linhas em Inspetoria, então não precisa backfill.
-- Caso existam linhas: assigna ao menor id de Delegacia existente; se não houver delegacia, falha (intencional).

DO $$
DECLARE
  fallback_id INT;
BEGIN
  IF EXISTS (SELECT 1 FROM "Inspetoria" LIMIT 1) THEN
    SELECT MIN(id) INTO fallback_id FROM "Delegacia";
    IF fallback_id IS NULL THEN
      RAISE EXCEPTION 'Não é possível adicionar Inspetoria.delegacia_id NOT NULL: existem inspetorias mas nenhuma delegacia.';
    END IF;
    ALTER TABLE "Inspetoria" ADD COLUMN "delegacia_id" INTEGER;
    UPDATE "Inspetoria" SET "delegacia_id" = fallback_id WHERE "delegacia_id" IS NULL;
    ALTER TABLE "Inspetoria" ALTER COLUMN "delegacia_id" SET NOT NULL;
  ELSE
    ALTER TABLE "Inspetoria" ADD COLUMN "delegacia_id" INTEGER NOT NULL;
  END IF;
END $$;

CREATE INDEX "Inspetoria_delegacia_id_idx" ON "Inspetoria" ("delegacia_id");

ALTER TABLE "Inspetoria"
  ADD CONSTRAINT "Inspetoria_delegacia_id_fkey"
  FOREIGN KEY ("delegacia_id") REFERENCES "Delegacia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
