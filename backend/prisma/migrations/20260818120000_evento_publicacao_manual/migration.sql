-- Evento com publicação manual: desliga publicar/despublicar por status e a
-- republicação ao mexer em boletim. Default false preserva o comportamento atual.
ALTER TABLE "Evento" ADD COLUMN "publicacao_manual" BOOLEAN NOT NULL DEFAULT false;
