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
