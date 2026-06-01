-- Regra de anfitrião do evento:
-- 1) Competicao.considerar_anfitriao: flag que liga/desliga o privilégio.
-- 2) Evento.anfitriao_id: participante anfitrião (opcional). Se o participante
--    for deletado, o campo vira NULL (não bloqueia delete de participante).

ALTER TABLE "Competicao" ADD COLUMN "considerar_anfitriao" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Evento" ADD COLUMN "anfitriao_id" INTEGER;
ALTER TABLE "Evento"
  ADD CONSTRAINT "Evento_anfitriao_id_fkey"
  FOREIGN KEY ("anfitriao_id") REFERENCES "Participante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Evento_anfitriao_id_idx" ON "Evento" ("anfitriao_id");
