-- CreateTable
CREATE TABLE "Competicao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "estados" TEXT[],
    "adicionar_subtitulo" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competicao_nome_key" ON "Competicao"("nome");

-- AddForeignKey (movido de 20260529000000_drop_categoria_restruct_modalidade —
-- Modalidade.competicao_id existia mas a FK so faz sentido depois que Competicao foi criada)
ALTER TABLE "Modalidade" ADD CONSTRAINT "Modalidade_competicao_id_fkey" FOREIGN KEY ("competicao_id") REFERENCES "Competicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
