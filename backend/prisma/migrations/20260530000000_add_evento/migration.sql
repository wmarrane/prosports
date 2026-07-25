-- CreateEnum
CREATE TYPE "EventoStatus" AS ENUM ('rascunho', 'inscricoes', 'pronto', 'sorteado', 'parcial');

-- DropTable
-- IF EXISTS: em banco LIMPO esta tabela ainda não existe (ela só é criada pela
-- migration posterior 20260530010000_restore_sistema_disputas_grupos), e o DROP
-- incondicional quebrava o replay do histórico do zero (erro 42P01).
-- `prisma migrate deploy` não verifica checksum, então ambientes já aplicados
-- (prod/VM de dev) não precisam de ação.
DROP TABLE IF EXISTS "sistema_disputas_grupos";

-- CreateTable
CREATE TABLE "Evento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "local" TEXT NOT NULL,
    "organizador" TEXT,
    "status" "EventoStatus" NOT NULL DEFAULT 'rascunho',
    "competicao_id" INTEGER NOT NULL,
    "municipio_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Evento_competicao_id_nome_key" ON "Evento"("competicao_id", "nome");

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_competicao_id_fkey" FOREIGN KEY ("competicao_id") REFERENCES "Competicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "Municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
