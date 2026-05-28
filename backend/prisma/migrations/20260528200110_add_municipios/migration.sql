/*
  Warnings:

  - You are about to drop the column `estado` on the `Delegacao` table. All the data in the column will be lost.
  - You are about to drop the column `municipio` on the `Delegacao` table. All the data in the column will be lost.
  - Added the required column `municipio_id` to the `Delegacao` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Delegacao" DROP COLUMN "estado",
DROP COLUMN "municipio",
ADD COLUMN     "municipio_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Municipio" (
    "id" SERIAL NOT NULL,
    "codigo_ibge" CHAR(7) NOT NULL,
    "nome" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Municipio_codigo_ibge_key" ON "Municipio"("codigo_ibge");

-- CreateIndex
CREATE INDEX "Municipio_uf_nome_idx" ON "Municipio"("uf", "nome");

-- CreateIndex
CREATE INDEX "Municipio_nome_idx" ON "Municipio"("nome");

-- AddForeignKey
ALTER TABLE "Delegacao" ADD CONSTRAINT "Delegacao_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "Municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
