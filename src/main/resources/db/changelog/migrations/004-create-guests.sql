-- liquibase formatted sql

-- changeset toilink:004-create-guests
CREATE TABLE guests
(
    id         BIGSERIAL PRIMARY KEY,
    event_id   BIGINT    NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    name       VARCHAR(100),
    phone      VARCHAR(20),
    notes      TEXT,
    token      UUID      NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guests_event_id ON guests (event_id);
CREATE INDEX idx_guests_token ON guests (token);
