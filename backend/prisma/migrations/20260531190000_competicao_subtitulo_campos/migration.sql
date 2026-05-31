-- Adiciona nova coluna de campos parametrizáveis (default: vazio)
ALTER TABLE "Competicao" ADD COLUMN "subtitulo_campos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Preserva comportamento atual: competições com adicionar_subtitulo=true
-- passam a usar apenas o subtítulo
UPDATE "Competicao" SET "subtitulo_campos" = ARRAY['subtitulo']
WHERE "adicionar_subtitulo" = true;

-- Remove coluna antiga
ALTER TABLE "Competicao" DROP COLUMN "adicionar_subtitulo";
