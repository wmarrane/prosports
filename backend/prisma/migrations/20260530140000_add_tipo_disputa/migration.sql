-- Add TipoDisputa enum and tipo column to TipoModalidade.

CREATE TYPE "TipoDisputa" AS ENUM ('grupos', 'chaves', 'especifico', 'ordem_entrada');

ALTER TABLE "TipoModalidade"
  ADD COLUMN "tipo" "TipoDisputa" NOT NULL DEFAULT 'grupos';
