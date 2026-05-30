-- Add Sorteio table.

CREATE TABLE "Sorteio" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "tipo" "TipoDisputa" NOT NULL,
  "seed" TEXT NOT NULL,
  "resultado" JSONB NOT NULL,
  "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sorteio_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Sorteio_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Sorteio_evento_id_modalidade_id_key"
  ON "Sorteio"("evento_id","modalidade_id");

CREATE INDEX "Sorteio_evento_id_idx"
  ON "Sorteio"("evento_id");
