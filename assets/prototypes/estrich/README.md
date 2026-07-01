ok,# gogridas — CRM

**Go Gridas** is a self-hosted CRM for a small construction/renovation business. It tracks every job from start to payout — what work was done, at which property, by which crew, what was spent, what was earned, and what each employee gets paid.

| Module           | Purpose |
|------------------|---------|
| **Pārskats**     | Central dashboard with date-range filtering, summary totals, and tabbed tables across all data types — work done, income, expenses, payouts, and employee list. |
| **Padarītais darbs** | 3-step wizard for recording completed jobs: (1) property info & received amount, (2) work types performed, (3) crew composition with automatic payout calculation. Supports optional fields like client phone, address, distance, and employee notes. |
| **Ienākumi**     | Track all revenue — cash and bank income with date filtering and running totals. Income can optionally be recorded directly from the work-done flow. |
| **Izdevumi**     | Track expenses categorized by type (Expenses, Assets, Materials, Other), with date filtering and totals. |
| **Darbinieki**   | Employee directory with contact details, qualification percentage, deduction percentage, notes, emergency contacts, and home city/address. |
| **Izmaksas**     | Payable tracking showing what each employee is owed. Supports deduction payouts — paying out accumulated deductions separately from regular salary. |

Built with **Spring Boot** (Java 21, JPA/Hibernate), a **vanilla JS** single-page frontend served by nginx, **PostgreSQL** for data storage, and an **nginx reverse proxy** that ties everything together. The entire stack runs in **Docker Compose**, making it reproducible locally and on a VPS in minutes.

---

## Project structure

```
.
├── Dockerfile                          ← backend multi-stage build (Maven → JRE)
├── app.sh                              ← helper script for common commands
├── backend/
│   ├── pom.xml                         ← Maven config (Java 21, Spring Boot)
│   ├── nginx/default.conf              ← nginx reverse proxy config
│   └── src/                            ← Java source, tests, resources
├── frontend/
│   ├── Dockerfile                      ← frontend nginx image
│   ├── nginx/default.conf              ← frontend nginx config
│   ├── public/                         ← static HTML/CSS/JS
│   └── tests/                          ← Jest tests (module, E2E, UI automation)
├── docker/
│   ├── docker-compose.yml              ← base compose (local + VPS)
│   ├── docker-compose.override.yml     ← local-only JMX & remote debug wiring
│   ├── docker-compose.jmx.yml          ← JMX profile with host binding
│   └── entrypoint.sh                   ← backend container entrypoint
├── db/
│   ├── Dockerfile.postgres             ← PostgreSQL image with init scripts
│   ├── *.sql                           ← schema migrations + seed data + ingest
│   └── gogridas_db_schema.svg          ← database schema diagram
├── docs/                               ← documentation (currently empty)
└── .env.prod.example                   ← copy to .env, fill in secrets
```

---

## Local development

> **Note:** Always run all commands from the project root directory.

### First time setup

```bash
cp .env.prod.example .env
```

### Start everything (full rebuild)

```bash
./app.sh build
./app.sh run
```

Shortcut — build + run in one step:

```bash
./app.sh buildrun
```

### Daily workflow

```bash
./app.sh build                  # build + tests (backend + frontend)
./app.sh build back             # build + tests backend only
./app.sh build front            # build + tests frontend only
./app.sh run                    # start/recreate all containers
./app.sh run backend            # recreate backend container only
./app.sh run frontend           # recreate frontend container only
./app.sh buildrun back          # build back + recreate backend container
./app.sh logs backend           # tail backend logs
./app.sh status                 # show container status + ports
./app.sh stop                   # stop all services
./app.sh flush                  # ⚠️ wipe DB volume entirely
```

### Local URLs

| Service        | URL                                       |
|----------------|-------------------------------------------|
| Frontend       | http://localhost:8088                     |
| Frontend (direct) | http://localhost:3000                   |
| Backend        | http://localhost:8080/api                 |
| Swagger UI     | http://localhost:8080/api/swagger-ui.html |
| OpenAPI JSON   | http://localhost:8080/api/v3/api-docs     |
| Health Check   | http://localhost:8080/api/actuator/health |
| DB             | localhost:5432                            |

---

## VPS / production deployment

### What is exposed publicly in production

| Container            | Public       | Why                              |
|----------------------|--------------|----------------------------------|
| `crm_proxy` (nginx)  | `0.0.0.0:80` | Reverse proxy for everything     |
| `crm_backend`        | internal     | nginx proxies `/api/` to it      |
| `crm_db`             | internal     | never exposed to internet        |

### First deployment on VPS

```bash
git clone <repo-url> gogridas
cd gogridas
cp .env.prod.example .env
# edit .env and set DB_PASSWORD at minimum
nano .env

./app.sh build
./app.sh run
```

### Daily VPS workflow

```bash
./app.sh build                  # build + tests (backend + frontend)
./app.sh run                    # start/recreate stack
./app.sh status                 # show container status
./app.sh logs                   # tail all logs
./app.sh logs backend           # tail backend logs only
```

### Public URLs

```
http://<VPS_IP>/                       ← frontend
http://<VPS_IP>/api                    ← backend API
http://<VPS_IP>/api/employees          ← example endpoint
http://<VPS_IP>/api/actuator/health    ← health check
```

### Nuclear reset (wipe everything and start fresh on VPS)

⚠️ Deletes all database data.

```bash
docker compose -f docker/docker-compose.yml down -v --remove-orphans
docker image rm -f gogridas-backend gogridas-db 2>/dev/null || true
docker builder prune -af
./app.sh build
./app.sh run
```

---

## UI features
- Dark theme
- Keyboard shortcuts (e.g., `Shift+D` for Padarītais darbs)
- Searchable select dropdowns for cities and employees
- Work done settings panel for toggling optional fields (client phone, address, distance, notes)

---

## Testing

### Backend tests

```bash
./app.sh build back              # runs full Maven build including tests
# or directly:
cd backend && mvn test
```

### Frontend tests

The frontend has three test suites:

| Suite               | Command                    | Description                                              |
|---------------------|----------------------------|----------------------------------------------------------|
| Module tests        | `./app.sh build front`     | Mocked unit tests (`*.module.test.js`); run during build |
| E2E tests           | `./app.sh test:e2e`        | Node.js integration tests against running stack          |
| UI automation       | `./app.sh test:ui`         | Real browser (ChromeDriver) tests against running stack  |

Run a specific test file:

```bash
./app.sh test:e2e tests/e2eCoreBusinessFlows.test.js
./app.sh test:ui tests/ui.chromedriver.test.js
```

UI automation in headed mode (see the browser):

```bash
UI_HEADLESS=0 ./app.sh test:ui
```

> **Note:** E2E and UI tests require the full stack to be running (`./app.sh run` first).
> See `frontend/tests/README-ui-automation.md` for more details.

---

## JMX & remote debug (local development)

Enable JMX and remote debug by using the `--dev` flag:

```bash
./app.sh --dev run
```

| Feature         | Port             |
|-----------------|------------------|
| JMX             | 127.0.0.1:9010   |
| Remote debug    | 127.0.0.1:5007   |

Attach your IDE debugger to `127.0.0.1:5007`.

For JMX with full host binding (not loopback-only):

```bash
./app.sh run:jmx
```

---

## `app.sh` reference

```
Usage: ./app.sh [--dev|--override] {build|buildrun|run|run:jmx|stop|status|flush|logs|test:e2e|test:ui} [args...]
```

| Command            | Description                                           |
|--------------------|-------------------------------------------------------|
| `build [front\|back]` | Build and test backend and/or frontend              |
| `buildrun [svc...]`   | Build, then bring up services (or full stack)       |
| `run [svc...]`        | Recreate and start services (or full stack)         |
| `run:jmx`            | Start with JMX compose profile                       |
| `stop [svc]`         | Stop all services or a specific one                  |
| `status`             | Show container status and published ports            |
| `flush`              | Wipe DB volume (`docker compose down -v`)            |
| `logs [svc]`         | Tail logs (all or specific service)                  |
| `test:e2e [pattern]` | Run E2E tests                                        |
| `test:ui [pattern]`  | Run UI automation (ChromeDriver) tests               |

---

## HTTPS (optional, requires a domain)

### 1) Get certificate

```bash
docker compose -f docker/docker-compose.yml stop crm_proxy
sudo apt install -y certbot
sudo certbot certonly --standalone -d yourdomain.com
```

### 2) Update .env

```dotenv
SERVER_NAME=yourdomain.com
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 3) Start with HTTPS

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

### 4) Auto-renew hook

```bash
sudo bash -c 'cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<EOF
#!/bin/bash
docker exec crm_proxy nginx -s reload
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh'
```

---

## OCI / Oracle Cloud firewall (Security List ingress rules)

Minimum rules for a public web app:

| Source        | Protocol  | Port  | Purpose                     |
|---------------|-----------|-------|-----------------------------|
| `YOUR_IP/32`  | TCP       | `22`  | SSH (your IP only)          |
| `0.0.0.0/0`   | TCP       | `80`  | HTTP                        |
| `0.0.0.0/0`   | TCP       | `443` | HTTPS (when enabled)        |
| `0.0.0.0/0`   | ICMP 3,4  | —     | Required networking         |

Also open on VPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp    # when HTTPS is enabled
sudo ufw enable
```

---

## Troubleshooting

### Docker build hangs on Maven

Maven is downloading dependencies (~200 MB on first build). It just looks like a hang.

```bash
# See real-time progress
docker build --progress=plain --no-cache -t crm-backend .
```

### password authentication failed for user "postgres"

DB volume was created with a different password than your current `.env`.

```bash
# Option A: align password (keep data)
docker compose -f docker/docker-compose.yml exec db psql -U postgres -d postgres \
  -c "ALTER USER postgres WITH PASSWORD 'your_new_password';"
# then update DB_PASSWORD in .env and restart backend

# Option B: wipe and recreate (lose data)
docker compose -f docker/docker-compose.yml down -v
./app.sh build
./app.sh run
```

### UnknownHostException: db

Backend is trying to resolve Docker Compose hostname `db` but is not on the same network. Make sure you start the full stack together:

```bash
./app.sh run
```

### Schema-validation error

Run the migration against the running DB:

```bash
docker compose -f docker/docker-compose.yml exec -T db psql -U postgres -d crm_db \
  < db/01-cities-employees.sql
docker compose -f docker/docker-compose.yml restart backend
```

### SSL peer shut down / Maven Central TLS error

Transient network issue on VPS. The build retries automatically (3 attempts). If it keeps failing:

```bash
docker builder prune -af
./app.sh build
./app.sh run