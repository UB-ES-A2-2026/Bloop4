-- Preparació comuna de les proves d'integritat. Els runners (db/test.sh i la CI) l'envien a psql
-- davant de cada fitxer de db/tests/integrity/: cada fitxer s'executa en una sessió pròpia i acaba
-- amb ROLLBACK, així que no modifica les dades i no depèn de cap altre fitxer. Necessiten els seeds.
-- Cada cas imprimeix "OK · ..." o avorta amb "ERROR · ...".
\set ON_ERROR_STOP 1
SET client_min_messages TO notice;

BEGIN;

-- Executa p_sql i espera que falli amb l'SQLSTATE indicat.
CREATE FUNCTION pg_temp.expect_error(p_label text, p_sqlstate text, p_sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = p_sqlstate THEN
      RAISE NOTICE 'OK · % (% %)', p_label, SQLSTATE, SQLERRM;
      RETURN;
    END IF;
    RAISE EXCEPTION 'ERROR · %: s''esperava % i ha arribat % (%)', p_label, p_sqlstate, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'ERROR · %: la sentència havia de fallar amb % i no ha fallat', p_label, p_sqlstate;
END $$;

CREATE FUNCTION pg_temp.assert(p_label text, p_condition boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS NOT TRUE THEN
    RAISE EXCEPTION 'ERROR · %', p_label;
  END IF;
  RAISE NOTICE 'OK · %', p_label;
END $$;
