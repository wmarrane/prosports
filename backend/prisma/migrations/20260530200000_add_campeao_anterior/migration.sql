-- Add CampeaoAnterior table (3 slots fixos por evento × modalidade).

CREATE TABLE "CampeaoAnterior" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "participante_id" INTEGER NOT NULL,
  "posicao" INTEGER NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampeaoAnterior_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CampeaoAnterior_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CampeaoAnterior_participante_id_fkey"
    FOREIGN KEY ("participante_id") REFERENCES "Participante"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CampeaoAnterior_evento_id_modalidade_id_posicao_key"
  ON "CampeaoAnterior"("evento_id", "modalidade_id", "posicao");

CREATE INDEX "CampeaoAnterior_evento_id_modalidade_id_idx"
  ON "CampeaoAnterior"("evento_id", "modalidade_id");
