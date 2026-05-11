# AGENTS.md — AI Coding Agent Guide for gogridas

## Project Overview
- **Stack:** Spring Boot backend (Java 21), nginx-served static frontend, PostgreSQL, nginx reverse proxy, Docker Compose orchestration.
- **Purpose:** Employee and salary management CRM.

## Architecture & Data Flow
- **Backend:**
  - Located in `backend/` (Java, Spring Boot, JPA, PostgreSQL).
  - REST API under `/api` (see `application.yml` for context path).
  - Entities, DTOs, Repositories, Services, and Controllers follow standard Spring layering (see `backend/src/main/java/com/crm/`).
  - Health check: `/api/actuator/health`.
- **Frontend:**
  - Located in `frontend/` (static HTML/JS in `public/`, served by nginx in containers).
  - API calls use `/api` and are proxied to backend by nginx config.
  - No build step; static files served directly.
- **Database:**
  - PostgreSQL, initialized/migrated via SQL scripts in `backend/db/`.
  - DB connection configured via environment variables (see `application.yml`, Compose files).
- **nginx:**
  - Reverse proxy for frontend and backend (see `backend/nginx/`).
  - Only nginx is exposed publicly in production; backend and DB are internal-only.

## Developer Workflows
- **All commands should be run from the project root.**
- Use `./app.sh` for common tasks:
  - `./app.sh start` — full rebuild and start (local dev)
  - `./app.sh stop` — stop all containers
  - `./app.sh restart backend|frontend` — rebuild/restart specific service
  - `./app.sh logs backend` — tail backend logs
  - `./app.sh reset-db` — wipe DB and restart
- **Production:**
  - Use `./app.sh prod:start`, `prod:stop`, `prod:update`, etc. (see README for details)
- **Manual builds:**
  - Backend: `cd backend && mvn clean package -DskipTests`
  - Frontend: `cd frontend && npm install`
- **Testing:**
  - Backend tests: `mvn test` in `backend/`
  - No frontend tests defined.

## Project-Specific Conventions
- **API paths:** Always `/api/...` (see `application.yml`, nginx config, frontend proxy).
- **Environment variables:** Used extensively for DB, ports, and service config (see `.env.prod.example`, Compose files, `application.yml`).
- **Backend layering:**
  - Entities: `entity/`, DTOs: `dto/`, Data access: `repository/`, Business logic: `service/`, API: `controller/`.
  - Example: `EmployeeController` → `EmployeeService` → `EmployeeRepository` → `Employee`.
- **Frontend API proxy:**
  - All API calls go through `/api` and are proxied to backend by nginx.
  - Use relative `/api` paths in frontend JS for compatibility with reverse proxy.
- **DB migrations:**
  - SQL scripts in `backend/db/` are mounted into the DB container and run on startup.
- **Logs:**
  - Backend logs in `backend/logs/`, accessible via `./app.sh logs backend`.

## Integration Points
- **nginx config:**
  - See `backend/nginx/default.conf` for proxy rules.
- **Docker Compose:**
  - Main Compose file: `docker/docker-compose.yml` (services: db, backend, frontend, crm_proxy).
- **Health checks:**
  - Backend: `/api/actuator/health` (Spring Boot Actuator).
  - DB: Compose healthcheck on `db` service.

## References
- See `README.md` for full workflow and troubleshooting.
- Key directories: `backend/`, `frontend/`, `docker/`, `backend/db/`, `backend/logs/`.
- Example entity flow: `backend/src/main/java/com/crm/controller/EmployeeController.java` → `service/EmployeeService.java` → `repository/EmployeeRepository.java` → `entity/Employee.java`.

---
For more, see https://agents.md/ and the project README.

