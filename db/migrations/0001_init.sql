-- 報名/驗票 BC — 獨立 Postgres DB(動態資料,不進 Git 內容流程)

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 票種:reserved <= quota 由 CHECK + 條件式 UPDATE 雙重保證
CREATE TABLE ticket_types (
  ticket_type_id    text        PRIMARY KEY,
  event_id          text        NOT NULL,
  name              text        NOT NULL,
  description       text,
  price             integer     NOT NULL CHECK (price >= 0),
  quota             integer     NOT NULL CHECK (quota >= 0),
  reserved          integer     NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  sales_opens_at    timestamptz NOT NULL,
  sales_closes_at   timestamptz NOT NULL,
  requires_approval boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserved_within_quota CHECK (reserved <= quota)
);
CREATE INDEX idx_ticket_types_event ON ticket_types (event_id);
CREATE TRIGGER trg_ticket_types_updated_at
  BEFORE UPDATE ON ticket_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE registrations (
  registration_id text        PRIMARY KEY,
  event_id        text        NOT NULL,
  ticket_type_id  text        NOT NULL REFERENCES ticket_types (ticket_type_id),
  attendee_name   text        NOT NULL,
  attendee_email  text        NOT NULL,
  attendee_phone  text,
  attendee_diet   text,
  attendee_note   text,
  status          text        NOT NULL CHECK (status IN
                    ('submitted','pending_review','rejected','confirmed','cancelled','checked_in','no_show')),
  payment         text        NOT NULL CHECK (payment IN
                    ('not_required','unpaid','paid_onsite','paid_online')),
  submitted_at    timestamptz NOT NULL,
  reviewed_at     timestamptz,
  reject_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_registrations_event_status ON registrations (event_id, status);
CREATE INDEX idx_registrations_email ON registrations (attendee_email);
CREATE INDEX idx_registrations_ticket_type ON registrations (ticket_type_id);
CREATE TRIGGER trg_registrations_updated_at
  BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tickets (
  ticket_id       text        PRIMARY KEY,
  registration_id text        NOT NULL REFERENCES registrations (registration_id),
  qr_token        text        NOT NULL,
  status          text        NOT NULL CHECK (status IN ('issued','checked_in','void')),
  issued_at       timestamptz NOT NULL,
  checked_in_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_registration ON tickets (registration_id);
CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 驗票紀錄:append-only(不做 UPDATE/DELETE)
CREATE TABLE check_in_records (
  record_id  text        PRIMARY KEY,
  ticket_id  text,
  gate       text,
  scanned_at timestamptz NOT NULL,
  result     text        NOT NULL CHECK (result IN ('success','duplicate','invalid')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_check_in_records_ticket ON check_in_records (ticket_id, scanned_at);
