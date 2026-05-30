-- Add Inscricao table (Evento × Modalidade × Participante).

CREATE TABLE "Inscricao" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "participante_id" INTEGER NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inscricao_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Inscricao_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Inscricao_participante_id_fkey"
    FOREIGN KEY ("participante_id") REFERENCES "Participante"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Inscricao_evento_id_modalidade_id_participante_id_key"
  ON "Inscricao"("evento_id","modalidade_id","participante_id");

CREATE INDEX "Inscricao_evento_id_modalidade_id_idx"
  ON "Inscricao"("evento_id","modalidade_id");
