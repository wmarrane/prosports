-- CreateTable
CREATE TABLE "bracket_chaves_byes" (
    "numero_inscrito" INTEGER NOT NULL,
    "posicoes_bye" INTEGER[],

    CONSTRAINT "bracket_chaves_byes_pkey" PRIMARY KEY ("numero_inscrito")
);
