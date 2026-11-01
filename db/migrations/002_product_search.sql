-- 002 · Cerca de productes per paraula clau (US-01).
-- Tot es fa dins de PostgreSQL: full-text amb la configuració 'spanish' per al rànquing i
-- trigrames (pg_trgm) per tolerar errors tipogràfics. Ni majúscules ni accents compten.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() és STABLE (depèn del diccionari configurat) i no es pot fer servir en un índex.
-- Aquesta funció fixa el diccionari i és IMMUTABLE, així que sí que es pot indexar.
CREATE OR REPLACE FUNCTION search_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, value)) $$;

-- Full-text sobre el nom: rànquing amb ts_rank.
CREATE INDEX IF NOT EXISTS products_name_fts_idx
  ON products USING gin (to_tsvector('spanish', search_normalize(name)));

-- Trigrames sobre el nom: coincidències parcials ("micro") i errors lleus ("microfno").
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING gin (search_normalize(name) gin_trgm_ops);
