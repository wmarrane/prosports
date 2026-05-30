-- Adopt existing sistema_disputas_chaves table (already exists in dev DB).
-- IF NOT EXISTS makes it safe for both adopted-dev and fresh environments.

CREATE TABLE IF NOT EXISTS "sistema_disputas_chaves" (
  "id" SERIAL PRIMARY KEY,
  "numero_inscrito" INTEGER NOT NULL,
  "posicao_primeiro_cabeca" INTEGER NOT NULL,
  "posicao_segundo_cabeca" INTEGER NOT NULL,
  "posicao_terceiro_cabeca" INTEGER NOT NULL,
  "posicao_quarto_cabeca" INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sistema_disputas_chaves_numero_inscrito_key"
  ON "sistema_disputas_chaves"("numero_inscrito");
