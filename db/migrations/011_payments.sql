-- 011 · Pagament únic amb targeta i retenció de la fiança (US-08).
-- El cobrament el fa una passarel·la externa (Stripe en mode de proves, o la passarel·la simulada
-- en desenvolupament i a la CI). Aquí només es guarden referències de la passarel·la i imports:
-- mai cap dada de targeta.

CREATE SEQUENCE IF NOT EXISTS receipt_number_seq;

-- Un intent de cobrament d'una reserva (una sessió de pagament de la passarel·la).
CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
  provider        text NOT NULL CHECK (provider IN ('mock', 'stripe')),
  -- Sessió de pagament a la passarel·la i la pàgina on el client paga.
  provider_ref    text NOT NULL CHECK (btrim(provider_ref) <> ''),
  checkout_url    text NOT NULL CHECK (btrim(checkout_url) <> ''),
  -- Cobrament resultant (per poder-lo retornar) i client de la passarel·la (per retenir la fiança).
  charge_ref      text,
  customer_ref    text,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  currency        char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded')),
  receipt_number  text UNIQUE CHECK (receipt_number ~ '^R-[0-9]{4}-[0-9]{6,}$'),
  failure_reason  text CHECK (btrim(failure_reason) <> ''),
  created_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz,
  UNIQUE (provider, provider_ref),
  CHECK (status NOT IN ('succeeded', 'refunded') OR (paid_at IS NOT NULL AND receipt_number IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS payments_event_id_idx ON payments (event_id);
-- Cap cobrament duplicat: com a molt un pagament completat i un en curs per reserva.
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_succeeded_per_event ON payments (event_id) WHERE status = 'succeeded';
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_per_event ON payments (event_id) WHERE status = 'pending';

-- Retenció de la fiança d'una reserva: es reté (no es cobra) i s'allibera quan el material torna bé.
-- 'scheduled' = encara no es pot retenir perquè falta molt per al lliurament; es farà a scheduled_for.
CREATE TABLE IF NOT EXISTS deposit_holds (
  event_id        uuid PRIMARY KEY REFERENCES events (id) ON DELETE RESTRICT,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  currency        char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status          text NOT NULL CHECK (status IN ('scheduled', 'held', 'released', 'failed')),
  scheduled_for   timestamptz NOT NULL,
  provider        text NOT NULL CHECK (provider IN ('mock', 'stripe')),
  provider_ref    text,
  held_at         timestamptz,
  released_at     timestamptz,
  failure_reason  text CHECK (btrim(failure_reason) <> ''),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'held' OR (provider_ref IS NOT NULL AND held_at IS NOT NULL)),
  CHECK (status <> 'released' OR released_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS deposit_holds_due_idx ON deposit_holds (scheduled_for) WHERE status = 'scheduled';

-- Avisos de la passarel·la ja processats: si en torna a enviar un, no es processa dues vegades.
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  provider     text NOT NULL CHECK (provider IN ('mock', 'stripe')),
  event_ref    text NOT NULL CHECK (btrim(event_ref) <> ''),
  received_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_ref)
);
