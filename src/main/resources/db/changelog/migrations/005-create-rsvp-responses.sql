-- liquibase formatted sql

-- changeset toilink:005-create-rsvp-responses
CREATE TABLE rsvp_responses
(
    id           BIGSERIAL PRIMARY KEY,
    guest_id     BIGINT    NOT NULL REFERENCES guests (id),
    event_id     BIGINT    NOT NULL REFERENCES events (id),
    status       VARCHAR(20) NOT NULL,
    group_size   INT         NOT NULL DEFAULT 1,
    comment      TEXT,
    responded_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (guest_id, event_id)
);

CREATE INDEX idx_rsvp_event_id ON rsvp_responses (event_id);
CREATE INDEX idx_rsvp_status ON rsvp_responses (event_id, status);
