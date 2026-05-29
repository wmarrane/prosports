-- Purge existing Categoria + Modalidade rows so the new NOT NULL columns can be added.
-- Modalidade is being restructured with required FKs (competicao_id, tipo_modalidade_id)
-- and a new required column (sigla); existing rows can't satisfy them.
DELETE FROM "Categoria";
DELETE FROM "Modalidade";

-- DropForeignKey
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_modalidade_id_fkey";

-- DropIndex
DROP INDEX "Modalidade_nome_key";

-- AlterTable
ALTER TABLE "Modalidade" DROP COLUMN "descricao",
ADD COLUMN     "competicao_id" INTEGER NOT NULL,
ADD COLUMN     "sigla" TEXT NOT NULL,
ADD COLUMN     "tipo_modalidade_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Categoria";

-- DropEnum
DROP TYPE "Genero";

-- CreateTable
CREATE TABLE "TipoModalidade" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoModalidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoModalidade_nome_key" ON "TipoModalidade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Modalidade_competicao_id_nome_key" ON "Modalidade"("competicao_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Modalidade_competicao_id_sigla_key" ON "Modalidade"("competicao_id", "sigla");

-- AddForeignKey
ALTER TABLE "Modalidade" ADD CONSTRAINT "Modalidade_competicao_id_fkey" FOREIGN KEY ("competicao_id") REFERENCES "Competicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modalidade" ADD CONSTRAINT "Modalidade_tipo_modalidade_id_fkey" FOREIGN KEY ("tipo_modalidade_id") REFERENCES "TipoModalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
