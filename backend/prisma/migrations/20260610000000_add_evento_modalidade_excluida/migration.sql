-- CreateTable
CREATE TABLE "evento_modalidade_excluida" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "modalidade_id" INTEGER NOT NULL,
    CONSTRAINT "evento_modalidade_excluida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evento_modalidade_excluida_evento_id_modalidade_id_key" ON "evento_modalidade_excluida"("evento_id", "modalidade_id");
CREATE INDEX "evento_modalidade_excluida_evento_id_idx" ON "evento_modalidade_excluida"("evento_id");

-- AddForeignKey
ALTER TABLE "evento_modalidade_excluida" ADD CONSTRAINT "evento_modalidade_excluida_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evento_modalidade_excluida" ADD CONSTRAINT "evento_modalidade_excluida_modalidade_id_fkey" FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
