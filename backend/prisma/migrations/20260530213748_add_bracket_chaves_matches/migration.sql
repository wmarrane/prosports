-- CreateTable
CREATE TABLE "bracket_chaves_matches" (
    "numero_inscrito" INTEGER NOT NULL,
    "matches_graph" JSONB NOT NULL,

    CONSTRAINT "bracket_chaves_matches_pkey" PRIMARY KEY ("numero_inscrito")
);
