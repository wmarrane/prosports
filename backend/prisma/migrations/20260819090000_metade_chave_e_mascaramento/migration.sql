-- Metade da chave por inscrição + mascaramento de nome por modalidade.
-- Aditivo: os dois booleanos nascem false e metade_chave nasce nula, então
-- nenhuma modalidade ou inscrição existente muda de comportamento.
ALTER TABLE "Modalidade" ADD COLUMN "usa_metade_chave" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Modalidade" ADD COLUMN "mascarar_nome" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inscricao" ADD COLUMN "metade_chave" TEXT;
