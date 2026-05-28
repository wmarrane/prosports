-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('MASCULINO', 'FEMININO', 'MISTO', 'LIVRE');

-- CreateTable
CREATE TABLE "Delegacao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "estado" CHAR(2) NOT NULL,
    "logo_path" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delegacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modalidade" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Modalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "modalidade_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "genero" "Genero" NOT NULL,
    "idade_min" INTEGER,
    "idade_max" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Modalidade_nome_key" ON "Modalidade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_modalidade_id_nome_genero_key" ON "Categoria"("modalidade_id", "nome", "genero");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_modalidade_id_fkey" FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
