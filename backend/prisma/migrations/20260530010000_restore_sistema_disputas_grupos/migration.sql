-- Restore table dropped by 20260530000000_add_evento.
-- Stores group composition rules per Competicao (used by modalidades do tipo "grupos").

CREATE TABLE "sistema_disputas_grupos" (
    "id" SERIAL PRIMARY KEY,
    "quantidade_equipes" INTEGER NOT NULL,
    "quantidade_grupos" INTEGER NOT NULL,
    "grupos_3_componentes" INTEGER NOT NULL,
    "grupos_4_componentes" INTEGER NOT NULL,
    "numero_classificados" INTEGER NOT NULL,
    "competicao_id" INTEGER NOT NULL,
    CONSTRAINT "sistema_disputas_grupos_competicao_id_fkey"
        FOREIGN KEY ("competicao_id") REFERENCES "Competicao"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "sistema_disputas_grupos_competicao_id_idx" ON "sistema_disputas_grupos"("competicao_id");
