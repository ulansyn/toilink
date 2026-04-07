# toilink — Project Guide

## Stack
- Java 21, Spring Boot 4.0.5
- PostgreSQL (JPA/Hibernate)
- Lombok
- Maven (use `./mvnw`)

## Package root
`kg.toilink`

## Conventions
- Layered architecture: entity → repository → service → controller
- Config in `src/main/resources/application.yaml`
- REST API via Spring MVC

## Build & run
```bash
./mvnw spring-boot:run
./mvnw test
./mvnw package
```
