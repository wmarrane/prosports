-- CreateEnum
CREATE TYPE "CategoriaBoletim" AS ENUM ('Resultados', 'Comunicado', 'Tabela', 'Regulamento', 'Outros');

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "data_fim" TIMESTAMP(3),
ADD COLUMN     "data_inicio" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Boletim" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" "CategoriaBoletim" NOT NULL,
    "data_publicacao" TIMESTAMP(3) NOT NULL,
    "filename" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boletim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Boletim_object_key_key" ON "Boletim"("object_key");

-- CreateIndex
CREATE INDEX "Boletim_evento_id_idx" ON "Boletim"("evento_id");

-- CreateIndex
CREATE UNIQUE INDEX "Boletim_evento_id_numero_key" ON "Boletim"("evento_id", "numero");

-- AddForeignKey
ALTER TABLE "Boletim" ADD CONSTRAINT "Boletim_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
