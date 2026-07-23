-- AlterTable
ALTER TABLE "Competicao" ADD COLUMN     "subtitulo_municipio_por_modalidade" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Inscricao" ADD COLUMN     "subtitulo" TEXT,
ADD COLUMN     "municipio_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "Municipio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
