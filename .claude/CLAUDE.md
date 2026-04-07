# ToiLink — Project Guide

## Stack
- Java 21, Spring Boot 4.0.5
- PostgreSQL + Liquibase + JSONB
- Lombok
- Thymeleaf (только для OG-страницы `/e/{slug}`)
- Frontend: Vanilla JS + Tailwind CDN
- Maven (`./mvnw`)

## Package root
`kg.toilink`

## Architecture
Layered: entity → repository → service → controller  
Два контроллера: `organizer/` (auth stub) и `pub/` (публичный, без auth)  
OG endpoint: `/e/{slug}` → Thymeleaf → Spring MVC Controller

## Auth (MVP stub)
`X-User-Phone: +996700000000` в header — находит/создаёт User по phone.  
Spring Security не используется до post-MVP.

## Branches
- `main` — стабильный код
- `dev` — интеграционная ветка
- `feature/xxx` — каждая задача от `dev`

## Commands
```bash
./mvnw spring-boot:run
./mvnw test
./mvnw package
```

## Key files
- `.claude/PLAN.md` — полный roadmap (читать перед началом новой задачи)
