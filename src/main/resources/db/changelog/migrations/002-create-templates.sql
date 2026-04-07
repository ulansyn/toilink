-- liquibase formatted sql

-- changeset toilink:002-create-templates
CREATE TABLE templates
(
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    thumbnail_url VARCHAR(500),
    category      VARCHAR(50)  NOT NULL DEFAULT 'OTHER',
    blocks_schema JSONB        NOT NULL,
    sort_order    INT          NOT NULL DEFAULT 0,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON templates (category);
CREATE INDEX idx_templates_sort ON templates (sort_order) WHERE is_active = TRUE;
