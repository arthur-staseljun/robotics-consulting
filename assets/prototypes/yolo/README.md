🎥 1. Video / kameras
•	RTSP kameras (standarts)
•	vai esošās CCTV

👉 svarīgi:
•	stabils stream (rtsp://)
•	1080p pietiek

⸻

🧠 2. AI (Computer Vision)

Must-have:
•	YOLOv8 / YOLOv9 (object detection)
•	DeepSORT (tracking)

👉 ar to tu iegūsi:
•	cilvēku ID
•	kustību
•	trajektorijas

Alternatīvas:
•	OpenCV
•	Detectron2 (smagāks)

⸻

⚙️ 3. Backend

Tu kā Java dev vari droši:
•	Spring Boot
•	REST API
•	WebSocket (realtime)

Ko glabā:
•	events (cilvēks X kustas)
•	timestamps
•	darba sesijas

⸻

🗄️ 4. Data storage
•	PostgreSQL (events, atskaites)
•	Redis (realtime)
•	S3 / MinIO (video fragmenti)

⸻

☁️ 5. Infra

MVP:
•	viena mašīna ar GPU
•	vai:
•	AWS EC2 (g4/g5)
•	vai lokāls serveris

⸻

📊 6. Dashboard
•	React / Next.js
•	vai vienkārši:
•	Grafana
•	Metabase

⸻

🧩 7. “Gudrā loģika” (svarīgākais)

Šis nav AI — tas ir tavs kods:

piemērs:
ja 3 cilvēki vienā zonā > 10 min
→ "notiek montāža"

ja nav kustības > 15 min
→ "pauze"

---

## POC implementation (Java backend + AWS)

This repository now includes a Java MVP backend aligned with your direction:

- `backend/`: Spring Boot backend (REST + WebSocket + PostgreSQL + Redis)
- `aws/terraform/`: AWS baseline infra (ECS/Fargate + ALB + RDS + Redis + S3)
- `py/tools/demo_ingest.py`: synthetic camera ingestion producer

### Implemented MVP scope

1. People detection/counting ingestion
- Endpoint: `POST /api/ingest/snapshots`
- Accepts camera state snapshots (`peopleCount`, `movingCount`, `trackIds`, timestamp)
- Designed so YOLO/DeepSORT worker can push data from RTSP processing

2. Real-time monitoring
- Endpoint: `GET /api/live/summary`
- WebSocket: `/ws/live`
- Pushes live summary, snapshots, and events

3. Basic activity reports
- Endpoint: `GET /api/reports/daily`
- Computes shift progress metrics (average people, peak, idle/active minutes, schedule alignment)

### Security model (MVP)

- Ingestion endpoints (`/api/ingest/**`) require `X-API-Key`
- Read endpoints (`/api/live/**`, `/api/events`, `/api/reports/**`, `/api/cameras`) require JWT
- WebSocket `/ws/live` requires `?token=<jwt>` query parameter

---

## 🚀 Run scripts

Three convenience scripts are provided under `scripts/`.  
Copy `.env.example` to `.env` and edit credentials once — all scripts pick it up automatically.

Default local ports are intentionally non-conflicting:

- backend: `18080`
- PostgreSQL: `55432`
- Redis: `56379`

```bash
cp .env.example .env
```

---

### Option A — Docker Compose (recommended, no local Postgres/Redis needed)

```bash
# Start infra + backend
./scripts/run-docker.sh

# Rebuild backend image first
./scripts/run-docker.sh --rebuild

# Also stream synthetic camera data (demo_ingest.py)
./scripts/run-docker.sh --demo

# Stop everything
./scripts/run-docker.sh --stop
```

> Requires Docker Desktop (or Docker Engine) with Compose v2.

---

### Option B — bare-metal local (Maven, no Docker)

Requires Java 17+, Maven 3.8+, and a running PostgreSQL + Redis.
The default local `.env` points to PostgreSQL `55432` and Redis `56379` so it does not collide with other stacks already using `5432` / `6379`.

```bash
# Start backend only
./scripts/run-local.sh

# Start backend + demo camera stream in background
./scripts/run-local.sh --demo
```

Quick infra spinup for bare-metal mode:

```bash
docker run -d --name monitoring-pg \
  -e POSTGRES_DB=monitoring -e POSTGRES_USER=monitoring -e POSTGRES_PASSWORD=monitoring \
  -p 55432:5432 postgres:16-alpine

docker run -d --name monitoring-redis -p 56379:6379 redis:7-alpine
```

---

### Option C — AWS (remote) deploy

Prerequisites: AWS CLI v2, Docker, Terraform already applied.

```bash
# Set required vars (in .env or exported)
export AWS_REGION=eu-central-1
export AWS_ACCOUNT_ID=123456789012
export PROJECT=yolo-monitoring        # must match terraform var.project

./scripts/deploy-aws.sh
```

The script will:
1. Build the backend Docker image for `linux/amd64`
2. Push it to ECR (tagged with the current git SHA + `latest`)
3. Register a new ECS task-definition revision with the new image
4. Trigger a rolling ECS Fargate re-deploy and wait for stability
5. Print the ALB endpoint when done

For first-time infra provisioning:

```bash
cd aws/terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars
terraform init
terraform plan
terraform apply
```

---

### Option D — One-command local live stack (non-8080 friendly)

Starts everything needed for the local live dashboard flow in one command:

- PostgreSQL on `55432`
- Redis on `56379`
- Java backend on `18080`
- Python live dashboard on `8000`

```bash
./scripts/run-live-stack.sh

# Start stack + synthetic ingest producer
./scripts/run-live-stack.sh --demo

# Status / stop
./scripts/run-live-stack.sh --status
./scripts/run-live-stack.sh --stop
```

You can override ports with env vars: `BACKEND_PORT`, `DASHBOARD_PORT`, `POSTGRES_PORT`, `REDIS_PORT`.

---

### Get a JWT token

```bash
curl -s -X POST http://localhost:18080/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

### Useful API checks

```bash
TOKEN='<paste_jwt_here>'
curl -H "Authorization: Bearer $TOKEN" http://localhost:18080/api/live/summary
curl -H "Authorization: Bearer $TOKEN" 'http://localhost:18080/api/events?limit=10'
curl -H "Authorization: Bearer $TOKEN" http://localhost:18080/api/reports/daily
```

### Run tests

```bash
cd backend && mvn test
```

---

## YOLO camera pipeline -> dashboard

The Python pipeline can now run YOLO person detection per camera and push snapshots/events to the Java backend (`/api/ingest/*`).
Those ingested updates are then exposed by `GET /api/live/summary` and broadcast over `/ws/live` for the dashboard.

### YOLO/RTSP setup

1. Install RTSP/YOLO extras:

```bash
pip install -r py/requirements-rtsp.txt
```

2. Copy the provided example config and set your RTSP URLs:

```bash
cp config/cameras.yolo.example.json config/cameras.yolo.json
```

3. Start backend (so ingest endpoints are available):

```bash
./scripts/run-local.sh
```

4. Run the Python pipeline with the YOLO config:

```bash
POC_CONFIG_PATH=config/cameras.yolo.json python py/run.py
```

or, after the package move:

```bash
POC_CONFIG_PATH=config/cameras.yolo.json python -m py.run
```

### iPhone camera quick start (macOS Continuity Camera)

A ready config is included at `config/cameras.iphone.json`.

Confirmed working flow:

```bash
python3 py/tools/list_cameras.py --max-index 8
./scripts/run-live-stack.sh --foreground --config config/cameras.iphone.json
```

1. Enable Continuity Camera on iPhone (same Apple ID, Wi-Fi and Bluetooth on).
2. Detect camera index on macOS (recommended):

```bash
python3 py/tools/list_cameras.py --max-index 8
```

Use an index with `yes/yes` in output as `"source.uri"`.
If `source.uri` is still `"0"`, it may open the Mac camera instead of iPhone - use the iPhone index reported by the probe.
3. Start the local live stack with iPhone config:

```bash
./scripts/run-live-stack.sh --foreground --config config/cameras.iphone.json
```

> `--foreground` keeps the script running in your terminal and releases the camera + stops all processes automatically on `Ctrl+C`.

4. If no frames appear, edit `config/cameras.iphone.json` and change `"source.uri"` to another detected index.

---

### iPhone camera via RTSP (no macOS Camera permission needed)

This mode uses a network stream — macOS never asks for Camera permission.

**Step 1 — Install a free RTSP server app on iPhone:**

| App | RTSP URL format |
|-----|----------------|
| **IP Camera Lite** | `rtsp://IPHONE_IP:8554/live` |
| **RTSP Camera Server** | `rtsp://IPHONE_IP:8554/live` |
| **Larix Broadcaster** | configure push to `rtsp://IPHONE_IP:1935/live` |

**Step 2 — Find your iPhone's IP:**
- Settings → Wi-Fi → tap your network → IP Address

**Step 3 — Edit the config:**

```bash
nano config/cameras.iphone.rtsp.json
# Replace IPHONE_IP with actual IP, e.g.:
# "uri": "rtsp://192.168.1.42:8554/live"
```

**Step 4 — Run:**

```bash
./scripts/run-live-stack.sh --foreground --config config/cameras.iphone.rtsp.json
```

iPhone and Mac must be on the same Wi-Fi network.

### Detector config fields

Each camera `detector` supports:

- `type`: `yolo` or `mock`
- `model`: YOLO model name/path (for example `yolo/yolov8n.pt`)
- `confidence`: confidence threshold (default `0.25`)
- `iou`: NMS IoU threshold (default `0.7`)
- `device`: inference device such as `cpu`, `0`, or `0,1` (optional)
- `image_size`: inference size (default `640`)

