-- liquibase formatted sql

-- changeset toilink:003-create-events
CREATE TABLE events
(
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       REFERENCES users (id),
    template_id     BIGINT       REFERENCES templates (id),
    title           VARCHAR(200) NOT NULL,
    event_date      TIMESTAMP,
    location        VARCHAR(500),
    cover_image_url VARCHAR(500),
    slug            VARCHAR(50)  NOT NULL UNIQUE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    rsvp_deadline   TIMESTAMP,
    language        VARCHAR(10)  NOT NULL DEFAULT 'ru',
    blocks_config   JSONB,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_slug ON events (slug);
CREATE INDEX idx_events_user_id ON events (user_id);
CREATE INDEX idx_events_status ON events (status);
