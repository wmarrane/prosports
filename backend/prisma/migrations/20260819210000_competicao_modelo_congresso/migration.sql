-- Modelo do relatório de congresso técnico, agora explícito por competição.
-- Antes o controller inferia o layout de `subtitulo_municipio_por_modalidade`,
-- que é uma flag sobre subtítulo/município — nada a ver com relatório. Quem
-- ligasse a flag herdava o layout do JEESP sem pedir.
ALTER TABLE "Competicao" ADD COLUMN "modelo_congresso" TEXT NOT NULL DEFAULT 'padrao';

-- Passo 1: preserva o comportamento atual por construção — quem hoje cai no
-- layout do JEESP continua nele.
UPDATE "Competicao" SET "modelo_congresso" = 'jeesp'
WHERE "subtitulo_municipio_por_modalidade" = true;

-- Passo 2: a única mudança pretendida — Praia Grande passa a usar o modelo
-- padrão (o dos Jogos Regionais).
UPDATE "Competicao" SET "modelo_congresso" = 'padrao'
WHERE "nome" = 'Jogos Escolares de Praia Grande';
