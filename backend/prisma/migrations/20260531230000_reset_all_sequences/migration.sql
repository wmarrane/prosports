-- Reseta todas as sequences (autoincrement) para MAX(id)+1 da tabela correspondente.
-- Idempotente: pode rodar quantas vezes for necessário sem efeito colateral.
-- Útil quando o banco recebe dados via seed/restore com IDs explícitos, deixando
-- as sequences "atrás" do max(id), o que causa P2002 em inserts subsequentes.

DO $$
DECLARE
  rec RECORD;
  max_id BIGINT;
BEGIN
  FOR rec IN
    SELECT s.relname AS seq_name, t.relname AS table_name, a.attname AS column_name
    FROM pg_class s
    JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE s.relkind = 'S' AND t.relkind = 'r'
  LOOP
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', rec.column_name, rec.table_name) INTO max_id;
    IF max_id > 0 THEN
      -- quote_ident preserva case-sensitivity dos nomes de sequence (ex: "User_id_seq")
      EXECUTE format('SELECT setval(%L, %s, true)', quote_ident(rec.seq_name), max_id);
    END IF;
  END LOOP;
END $$;
