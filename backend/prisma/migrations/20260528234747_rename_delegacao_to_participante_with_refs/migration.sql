-- DropForeignKey
ALTER TABLE "Delegacao" DROP CONSTRAINT "Delegacao_municipio_id_fkey";

-- DropTable
DROP TABLE "Delegacao";

-- CreateTable
CREATE TABLE "Inspetoria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspetoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegacia" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delegacia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participante" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "subtitulo" TEXT,
    "inspetoria_id" INTEGER,
    "delegacia_id" INTEGER,
    "municipio_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inspetoria_nome_key" ON "Inspetoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Delegacia_nome_key" ON "Delegacia"("nome");

-- AddForeignKey
ALTER TABLE "Participante" ADD CONSTRAINT "Participante_inspetoria_id_fkey" FOREIGN KEY ("inspetoria_id") REFERENCES "Inspetoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participante" ADD CONSTRAINT "Participante_delegacia_id_fkey" FOREIGN KEY ("delegacia_id") REFERENCES "Delegacia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participante" ADD CONSTRAINT "Participante_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "Municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
