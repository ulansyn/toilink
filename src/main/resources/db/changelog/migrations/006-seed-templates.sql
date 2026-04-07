-- liquibase formatted sql

-- changeset toilink:006-seed-templates
INSERT INTO templates (name, description, category, sort_order, blocks_schema)
VALUES ('Классическая свадьба',
        'Элегантный шаблон для свадебного торжества',
        'WEDDING',
        1,
        '[
          {"type": "hero",      "label": "Главный экран",   "fields": ["title", "subtitle", "image_url"]},
          {"type": "countdown", "label": "Обратный отсчёт", "fields": ["date"]},
          {"type": "details",   "label": "Детали события",  "fields": ["date_text", "time_text", "dress_code"]},
          {"type": "location",  "label": "Место",           "fields": ["address", "map_url"]},
          {"type": "contacts",  "label": "Контакты",        "fields": ["name", "phone"]}
        ]'::jsonb),

       ('День рождения / той',
        'Универсальный шаблон для праздничных мероприятий',
        'TOY',
        2,
        '[
          {"type": "hero",      "label": "Главный экран",   "fields": ["title", "subtitle", "image_url"]},
          {"type": "countdown", "label": "Обратный отсчёт", "fields": ["date"]},
          {"type": "location",  "label": "Место",           "fields": ["address", "map_url"]},
          {"type": "contacts",  "label": "Контакты",        "fields": ["name", "phone"]}
        ]'::jsonb);
