-- liquibase formatted sql

-- changeset toilink:001-create-users
CREATE TABLE users
(
    id         BIGSERIAL PRIMARY KEY,
    phone      VARCHAR(20)  NOT NULL UNIQUE,
    name       VARCHAR(100),
    role       VARCHAR(20)  NOT NULL DEFAULT 'CLIENT',
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users (phone);
