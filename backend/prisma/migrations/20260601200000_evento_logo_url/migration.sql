-- Adiciona logo customizada por evento. Caminho relativo servido em /uploads/eventos/<uuid>.<ext>
ALTER TABLE "Evento" ADD COLUMN "logo_url" TEXT;
