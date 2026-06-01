-- Migra sistema_disputas_chaves para ser por competição.
-- Estratégia:
-- 1) Adiciona competicao_id nullable
-- 2) Para cada competição, copia TODAS as linhas existentes (snapshot atual = template global)
-- 3) Apaga linhas órfãs (competicao_id null) — eram o template
-- 4) Torna competicao_id NOT NULL, adiciona FK + indexes
-- 5) Troca unique (numero_inscrito) por unique (competicao_id, numero_inscrito)

ALTER TABLE "sistema_disputas_chaves" ADD COLUMN "competicao_id" INTEGER;

-- Backfill: replica cada linha existente para cada competição
INSERT INTO "sistema_disputas_chaves"
  ("numero_inscrito", "posicao_primeiro_cabeca", "posicao_segundo_cabeca", "posicao_terceiro_cabeca", "posicao_quarto_cabeca", "competicao_id")
SELECT s.numero_inscrito, s.posicao_primeiro_cabeca, s.posicao_segundo_cabeca, s.posicao_terceiro_cabeca, s.posicao_quarto_cabeca, c.id
FROM "sistema_disputas_chaves" s
CROSS JOIN "Competicao" c
WHERE s.competicao_id IS NULL;

-- Remove as linhas template (sem competicao_id)
DELETE FROM "sistema_disputas_chaves" WHERE "competicao_id" IS NULL;

-- Torna a coluna obrigatória
ALTER TABLE "sistema_disputas_chaves" ALTER COLUMN "competicao_id" SET NOT NULL;

-- Drop unique antigo + cria novo composto
DROP INDEX IF EXISTS "sistema_disputas_chaves_numero_inscrito_key";
CREATE UNIQUE INDEX "sistema_disputas_chaves_competicao_id_numero_inscrito_key"
  ON "sistema_disputas_chaves" ("competicao_id", "numero_inscrito");
CREATE INDEX "sistema_disputas_chaves_competicao_id_idx"
  ON "sistema_disputas_chaves" ("competicao_id");

-- FK com cascade (consistente com SistemaDisputasGrupos)
ALTER TABLE "sistema_disputas_chaves"
  ADD CONSTRAINT "sistema_disputas_chaves_competicao_id_fkey"
  FOREIGN KEY ("competicao_id") REFERENCES "Competicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
