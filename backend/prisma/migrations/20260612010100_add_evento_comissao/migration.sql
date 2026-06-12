CREATE TABLE "evento_comissao" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    CONSTRAINT "evento_comissao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evento_comissao_evento_id_usuario_id_key" ON "evento_comissao"("evento_id", "usuario_id");
CREATE INDEX "evento_comissao_usuario_id_idx" ON "evento_comissao"("usuario_id");
ALTER TABLE "evento_comissao" ADD CONSTRAINT "evento_comissao_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evento_comissao" ADD CONSTRAINT "evento_comissao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
