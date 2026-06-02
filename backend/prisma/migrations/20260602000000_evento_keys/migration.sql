-- CreateTable
CREATE TABLE "EventoKey" (
  "id" SERIAL NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "evento_id" INTEGER NOT NULL,
  "device_fp" TEXT,
  "device_label" TEXT,
  "first_used_at" TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "revogado_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criada_por" INTEGER NOT NULL,
  CONSTRAINT "EventoKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventoKey_token_key" ON "EventoKey"("token");
CREATE UNIQUE INDEX "EventoKey_evento_id_email_key" ON "EventoKey"("evento_id", "email");
CREATE INDEX "EventoKey_evento_id_idx" ON "EventoKey"("evento_id");
CREATE INDEX "EventoKey_token_idx" ON "EventoKey"("token");

ALTER TABLE "EventoKey" ADD CONSTRAINT "EventoKey_evento_id_fkey"
  FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventoKey" ADD CONSTRAINT "EventoKey_criada_por_fkey"
  FOREIGN KEY ("criada_por") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
