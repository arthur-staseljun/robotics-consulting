1. Что это за проект в целом
   У тебя здесь гибридный проект из двух частей:
   Python-часть — это CV/YOLO pipeline:
   читает камеры,
   делает детекцию людей,
   трекает их,
   считает метрики,
   генерирует события,
   и отправляет их в Java backend.
   Java-часть — это основной backend:
   принимает ingest от Python,
   сохраняет snapshots/events в PostgreSQL,
   держит live-состояние в Redis / памяти,
   отдает REST API,
   шлет realtime по WebSocket,
   формирует daily report,
   готов для локального запуска, Docker и AWS.
   То есть логика сейчас такая:
   Камера / RTSP → Python YOLO worker → Java backend → БД / Redis → API / WebSocket → dashboard

2. Как проект работает по шагам
   Основной рабочий сценарий
   Сценарий A: реальная камера + YOLO
   В конфиге камеры указываешь источник:
   opencv + uri (rtsp://... или 0 для webcam)
   В конфиге камеры указываешь детектор:
   yolo
   модель yolov8n.pt
   Python worker:
   берет кадр,
   запускает YOLO,
   получает bounding boxes людей,
   передает их в трекер.
   Трекер:
   назначает стабильные track_id,
   считает, кто движется, а кто нет.
   Python pipeline формирует:
   snapshot (people_count, moving_count, track_ids)
   event (pause_detected, assembly_in_progress, count_changed)
   Snapshot/event пишется:
   локально в SQLite для Python POC
   и/или отправляется в Java backend по HTTP.
   Java backend:
   сохраняет snapshot/event в PostgreSQL,
   обновляет live-state в Redis или in-memory,
   публикует обновление по WebSocket.
   Dashboard / клиент:
   делает GET /api/live/summary
   подписывается на /ws/live
   обновляет экран.

Сценарий B: демо без настоящих камер
Если взять mock detector + demo source:
кадры не читаются реально,
detector генерирует детекции искусственно,
pipeline ведет себя как будто камера работает,
это удобно для demo/test/POC.

Сценарий C: synthetic ingest без Python CV
Можно вообще не запускать YOLO, а стартовать py/tools/demo_ingest.py. Он просто шлет в Java backend синтетические snapshots/events, чтобы:
проверить API,
увидеть обновления на dashboard,
протестировать realtime.

3. Главная архитектурная мысль
   Очень важно: в репозитории видно историческое развитие проекта.
   Старый слой / POC
   Папка app/ — это самостоятельный FastAPI POC:
   со своим SQLite,
   со своим WebSocket,
   со своей HTML-страницей,
   со своей отчетностью.
   Новый основной слой
   Папка backend/ — это уже Spring Boot backend:
   PostgreSQL,
   Redis,
   JWT,
   API key,
   Docker,
   AWS,
   Sonar/JaCoCo.
   То есть сейчас проект уже не “только Python”.
   Python остался как worker/ingest/CV слой, а Java — как основной backend.

4. Назначение папок верхнего уровня

/README.md
Главный документ проекта:
исходная идея (камеры, AI, backend, storage, infra, dashboard),
описание MVP на Java + AWS,
сценарии запуска:
Docker,
local,
AWS,
примеры API,
сценарий YOLO → backend → dashboard.

/docker-compose.yml
Локальный стек через Docker:
postgres
redis
backend
demo-ingest (опционально, через profile demo)
Используется для самого простого локального старта всей системы.

/requirements.txt
Базовые Python-зависимости:
fastapi
uvicorn
httpx
pytest
Это минимальный набор для Python POC/API/tests.

/requirements-rtsp.txt
Дополнительные Python-зависимости для настоящего видео и YOLO:
opencv-python-headless
ultralytics
Используется, когда нужен RTSP/webcam и реальная модель.

/run.py
Точка входа в Python FastAPI POC.
Запускает uvicorn для app.main:app.
Это не Java backend. Это именно Python-приложение из app/.

/yolov8n.pt
Файл весов YOLO-модели.
Используется в YoloPersonDetector, если указан как model, либо как дефолтная модель.

/.env.example
Шаблон env-переменных для локального запуска Java backend:
PORT
DB_URL, DB_USER, DB_PASSWORD
REDIS_HOST, REDIS_PORT, REDIS_ENABLED
INGEST_API_KEY
JWT_SECRET, JWT_EXP_MIN
DASHBOARD_USERNAME, DASHBOARD_PASSWORD

5. Папка app/ — Python POC и CV pipeline

/app/__init__.py
Маркер Python-пакета.
Логики почти нет.

/app/config.py
Загрузка и парсинг JSON-конфига камер.
Что делает:
описывает dataclass-конфиги:
ScheduleConfig
SourceConfig
DetectorConfig
CameraConfig
BackendSinkConfig
AppConfig
читает JSON-файл из config/
превращает его в typed-конфиг
Это центральное место конфигурации Python worker-а.

/app/database.py
Локальная SQLite-база для Python POC.
Что хранит:
snapshots
events
Что умеет:
создать схему,
вставлять snapshot/event,
читать recent events,
читать snapshots за период.
Это локальный POC storage, отдельный от Java/PostgreSQL.

/app/main.py
Главный FastAPI application для Python POC.
Что делает:
загружает конфиг,
открывает SQLite,
поднимает ProcessingManager,
поднимает LiveHub,
создает endpoints:
/
/api/cameras
/api/live/summary
/api/events
/api/reports/daily
/ws/live
То есть это мини-backend на Python, который исторически был первым вариантом.

/app/static/index.html
Простейший HTML dashboard для Python POC.
Что делает:
грузит summary/report/events по REST,
открывает WebSocket,
при сообщениях перечитывает данные,
рисует карточки по камерам и метрики.
Важно: по структуре JSON видно, что этот файл ориентирован именно на Python API со snake_case полями.
Это старый POC-дашборд, а не полноценный frontend под Java security model.

/app/services/__init__.py
Маркер пакета.

/app/services/live.py
Простейший WebSocket hub для Python POC.
Что делает:
хранит список подключений,
принимает websocket,
рассылает JSON всем клиентам.

/app/services/sources.py
Источники кадров для Python pipeline.
Содержит:
FrameSample
Контейнер:
frame
observed_at
DemoFrameSource
Ничего не читает с камеры, просто имитирует поток времени.
OpenCVFrameSource
Читает реальный поток через OpenCV:
webcam ("0")
RTSP
видеофайл
Если поток отвалился — пробует переподключиться.
build_source(...)
Фабрика источника:
demo
opencv

/app/services/detectors.py
Детекторы людей.
Содержит:
Detection
Одна детекция:
bbox
confidence
label
centroid
MockPersonDetector
Фейковый детектор для demo/tests.
Генерирует детекции по математическому циклу.
YoloPersonDetector
Реальный YOLO через ultralytics.YOLO.
Что делает:
загружает модель,
запускает predict,
берет только класс person,
преобразует результаты в Detection.
build_detector(...)
Фабрика:
mock
yolo

/app/services/tracking.py
Трекинг объектов между кадрами.
Содержит:
Track
Выходной объект для текущего состояния трека:
track_id
bbox
centroid
is_moving
TrackState
Внутреннее состояние трека:
последняя позиция,
исчезновения,
last_seen,
флаг движения.
CentroidTracker
Простой centroid-based tracker:
матчит новые детекции к старым трекам по расстоянию,
создает новые треки,
удаляет пропавшие,
определяет движение.
Это не DeepSORT, а более легкий POC-трекер.

/app/services/backend_sink.py
Мост из Python в Java backend.
Что делает:
формирует HTTP POST,
отправляет snapshots в /api/ingest/snapshots
отправляет events в /api/ingest/events
добавляет X-API-Key
Это ключевой файл интеграции Python → Java.

/app/services/reporting.py
Формирует daily report на Python-стороне из SQLite.
Считает:
observations
average people
peak people
active/idle minutes
staffing gap
schedule alignment
event breakdown
notes
Логика похожа на Java report, но живет отдельно для POC.

/app/services/pipeline.py
Сердце Python pipeline.
Содержит:
CameraState
Live-состояние камеры:
counts
status
last_seen
track_ids
CameraWorker
Один поток на одну камеру.
Что делает в цикле:
берет sample из source
запускает detector
обновляет tracker
формирует live-state
публикует его
периодически сохраняет snapshot
отправляет snapshot в Java backend
проверяет бизнес-правила
при необходимости генерирует event
Правила:
изменение количества людей → count_changed
если достаточно активных людей долго → assembly_in_progress
если люди стоят без движения долго → pause_detected
ProcessingManager
Управляет всеми CameraWorker:
создает worker по каждой камере из конфига,
стартует,
останавливает,
хранит последние состояния камер.

6. Папка config/ — конфиги камер и pipeline

/config/cameras.json
Основной demo-конфиг:
две камеры,
demo source,
mock detector,
включен backend_sink на Java backend,
база data/poc.db
Это самый безопасный стартовый вариант.

/config/cameras.laptop.json
Конфиг для запуска на ноутбуке:
источник opencv с uri: "0" — встроенная камера,
detector yolo,
модель yolov8n.pt
backend_sink.base_url = http://127.0.0.1:18080
То есть этот файл явно ориентирован на локальный запуск backend на другом порту.

/config/cameras.yolo.example.json
Пример боевого конфига под RTSP:
opencv source
rtsp://...
yolo detector
yolov8n.pt
Это шаблон для реальных CCTV/RTSP камер.

7. Папка data/

/data/poc.db
SQLite-файл Python POC.
Хранит:
snapshots
events
Это runtime-данные, не код.

8. Папка py/tools/

/py/tools/demo_ingest.py
Генератор синтетических данных для Java backend.
Что делает:
шлет snapshots в /api/ingest/snapshots
иногда шлет event pause_detected
использует BACKEND_URL и INGEST_API_KEY
Это полезно, если нужно проверить Java backend без YOLO и без камер.

9. Папка py/tests/ — Python тесты

/py/tests/conftest.py
Добавляет корень проекта в sys.path, чтобы тесты могли импортировать app.*.

/py/tests/test_api.py
Проверяет Python FastAPI POC:
создает временный конфиг,
поднимает create_app(...),
ждет немного,
проверяет:
/api/live/summary
/api/reports/daily
/api/events

/py/tests/test_config.py
Проверяет, что load_config(...) корректно читает YOLO-настройки:
model
confidence
iou
device
image_size

/py/tests/test_reporting.py
Проверяет Python report-логику:
кладет snapshots/events в SQLite,
считает daily report,
сравнивает метрики.

/py/tests/test_tracking.py
Проверяет трекер:
что id сохраняется между кадрами,
что движение определяется правильно,
что пропавшие треки удаляются.

10. Папка scripts/ — сценарии запуска

/scripts/run-local.sh
Локальный запуск Java backend без Docker.
Что делает:
подгружает .env
задает дефолты
проверяет java, mvn
проверяет доступность PostgreSQL и Redis
запускает mvn spring-boot:run
опционально с --demo стартует py/tools/demo_ingest.py
Это основной сценарий для dev-режима.

/scripts/run-docker.sh
Запуск через Docker Compose.
Что делает:
при необходимости создает .env из .env.example
поднимает postgres, redis, backend
с --demo поднимает и synthetic ingest
с --rebuild пересобирает image
с --stop останавливает все

/scripts/deploy-aws.sh
Деплой Java backend в AWS.
Что делает:
собирает Docker image backend
логинится в ECR
пушит image
берет текущий ECS task definition
подменяет image
регистрирует новый revision
делает rolling deploy ECS service
ждет стабилизации
печатает ALB endpoint
Это operational script для remote deploy.

11. Папка aws/ — AWS инфраструктура

/aws/README.md
Краткое описание AWS deployment:
ECS Fargate
ECR
ALB
RDS PostgreSQL
ElastiCache Redis
S3
И важная ремарка:
Python/YOLO worker лучше держать отдельно, например на GPU EC2 g5.

/aws/terraform/providers.tf
Определяет:
версию Terraform
AWS provider
region

/aws/terraform/variables.tf
Входные переменные Terraform:
aws_region
project
vpc_id
private_subnet_ids
public_subnet_ids
ecs_cpu
ecs_memory
container_port

/aws/terraform/terraform.tfvars.example
Пример значений для Terraform variables.

/aws/terraform/main.tf
Главный AWS infra-файл.
Создает:
aws_ecr_repository — Docker registry
aws_security_group для ALB/ECS/RDS/Redis
aws_cloudwatch_log_group
aws_ecs_cluster
aws_lb + aws_lb_target_group + aws_lb_listener
IAM role для ECS task execution
aws_ecs_task_definition
aws_ecs_service
aws_db_subnet_group
aws_db_instance PostgreSQL
aws_elasticache_subnet_group
aws_elasticache_cluster Redis
aws_s3_bucket для видеофрагментов
Это основа AWS-деплоя backend.

/aws/terraform/outputs.tf
Выводит после terraform apply:
ECR URL
ALB DNS
endpoint PostgreSQL
endpoint Redis
имя S3 bucket

12. Папка backend/ — основной Java backend

/backend/Dockerfile
Двухэтапная Docker-сборка:
maven + temurin-17 → mvn package
temurin-17-jre → запускает jar

/backend/pom.xml
Главный Maven-файл.
Содержит:
Spring Boot 3.3.5
зависимости:
web
security
websocket
data-jpa
data-redis
flyway
postgresql
jjwt
test
H2 для тестов
JaCoCo для покрытия
Sonar параметры:
sonar.projectKey
sonar.host.url
sonar.coverage.jacoco.xmlReportPaths

/backend/src/main/resources/application.yml
Основной runtime-конфиг Java backend.
Определяет:
server.port
datasource PostgreSQL
Redis
Flyway
monitoring.*
security
schedule
cameras

/backend/src/main/resources/db/migration/V1__init_monitoring_tables.sql
Flyway migration:
создает snapshots
создает events
индексы по observed_at

13. Java код: backend/src/main/java/com/yolo/monitoring

/backend/src/main/java/com/yolo/monitoring/MonitoringBackendApplication.java
Главный класс Spring Boot приложения.

Папка config/
MonitoringProperties.java
Маппинг monitoring.* из application.yml в Java-объекты:
Redis
Security
Schedule
Camera

WebConfig.java
Разрешает CORS для всех путей.

WebSocketConfig.java
Регистрирует WebSocket endpoint:
/ws/live
Подключает WebSocketAuthInterceptor.

Папка security/
SecurityConfig.java
Главная security-конфигурация.
Правила:
/ — открыто
/api/auth/token — открыто
/api/ingest/** — только ROLE_INGEST
/api/** — нужен JWT
/ws/live — endpoint разрешен, но handshake отдельно проверяется интерсептором

ApiKeyAuthFilter.java
Проверяет X-API-Key для ingest routes.
Если ок — дает роль ROLE_INGEST.

JwtAuthFilter.java
Проверяет Bearer JWT для защищенных API.
Если токен валиден — создает authentication с ролью из claims.

JwtService.java
Создает и парсит JWT:
subject
role
expiration
подпись через jwtSecret

WebSocketAuthInterceptor.java
Проверяет JWT для WebSocket handshake.
Ожидает ?token=<jwt> в query string.

Папка api/
AuthController.java
Endpoint:
POST /api/auth/token
Проверяет логин/пароль dashboard-пользователя и возвращает JWT.

MonitoringController.java
Основной REST controller.
Endpoints:
GET / — health
GET /api/cameras
GET /api/live/summary
GET /api/events
GET /api/reports/daily
POST /api/ingest/snapshots
POST /api/ingest/events
Также после ingest публикует сообщения в realtime.

Папка dto/
AuthRequest.java
DTO для логина.
AuthResponse.java
DTO ответа с JWT.
SnapshotIngestRequest.java
DTO входящего snapshot.
EventIngestRequest.java
DTO входящего event.
DailyReportResponse.java
DTO итогового daily report.

Папка model/
Это domain-модели, с которыми работает сервисный слой.
CameraState.java
Live-состояние камеры:
counts
lastSeen
status
trackIds
StoredSnapshot.java
Snapshot после ingest/чтения.
StoredEvent.java
Event после ingest/чтения.

Папка persistence/
SnapshotEntity.java
JPA entity таблицы snapshots.
EventEntity.java
JPA entity таблицы events.
SnapshotRepository.java
JPA repository для snapshots.
EventRepository.java
JPA repository для events.

Папка realtime/
LiveWebSocketHandler.java
Держит открытые websocket-сессии и рассылает payload.
LivePublisher.java
Сервис-публикатор:
сериализует payload,
отправляет в websocket,
и при необходимости публикует в Redis channel.
LiveStateStore.java
Хранилище текущего live-state камер.
Что делает:
держит fallback in-memory map
если Redis включен — пишет/читает состояние туда
может публиковать события в Redis pub/sub

Папка service/
MonitoringService.java
Сердце Java backend.
Что делает:
получает snapshots/events от ingest controller
сохраняет их в PostgreSQL
обновляет LiveStateStore
собирает recent events
собирает daily report
формирует live summary
Это основной бизнес-сервис Java слоя.

14. Java тесты: backend/src/test

/backend/src/test/resources/application.yml
Тестовый конфиг:
H2 вместо PostgreSQL
Redis выключен
test credentials

/backend/src/test/java/com/yolo/monitoring/api/MonitoringControllerTest.java
Интеграционный тест controller:
проверяет ingest snapshot
проверяет security:
ingest без API key → 401
live summary без JWT → 401
получает JWT и проверяет успешный доступ

/backend/src/test/java/com/yolo/monitoring/service/MonitoringServiceTest.java
Проверяет report-логику Java backend:
ingest snapshots
строит daily report
сверяет метрики

15. Папка backend/target/ — не исходники, а артефакты сборки
    Это важно.
    target/ — это сгенерированная папка Maven, ее обычно не редактируют руками.
    Что там лежит:
    monitoring-backend-...jar — собранное приложение
    classes/ — compiled classes/resources
    generated-sources/
    generated-test-sources/
    surefire-reports/ — результаты тестов
    site/jacoco/ — coverage report
    sonar/ — Sonar артефакты
    test-classes/
    То есть это build output, а не “исходный код проекта”.

16. Где именно происходит связь YOLO → Java backend → dashboard
    Вот самые важные файлы этой интеграции:
    YOLO / CV
    app/services/sources.py
    app/services/detectors.py
    app/services/tracking.py
    Логика обработки камеры
    app/services/pipeline.py
    Отправка в Java
    app/services/backend_sink.py
    Прием на Java
    backend/src/main/java/com/yolo/monitoring/api/MonitoringController.java
    backend/src/main/java/com/yolo/monitoring/service/MonitoringService.java
    Realtime для dashboard
    backend/src/main/java/com/yolo/monitoring/realtime/LivePublisher.java
    backend/src/main/java/com/yolo/monitoring/realtime/LiveWebSocketHandler.java
    backend/src/main/java/com/yolo/monitoring/realtime/LiveStateStore.java

17. Что считать “главным” в проекте сейчас
    Если смотреть на текущее состояние репозитория:
    Главный production-oriented backend
    backend/
    aws/
    scripts/
    Главный CV worker / ingestion pipeline
    app/services/*
    config/*.json
    yolov8n.pt
    Старый POC слой
    app/main.py
    app/static/index.html
    app/database.py
    run.py

18. Важная практическая заметка
    В проекте видно, что часть конфигов и документации еще живет с дефолтом 8080, а часть уже настроена на другой локальный порт:
    например, config/cameras.laptop.json использует http://127.0.0.1:18080
    То есть проект уже частично адаптирован под запуск не на 8080, но исторические упоминания 8080 еще остались.

19. Если очень коротко: роль каждой крупной части
    app/ — Python CV pipeline + старый POC backend/UI
    backend/ — основной Java backend
    config/ — конфиги камер и YOLO
    scripts/ — запуск local/docker/aws
    aws/terraform/ — инфраструктура AWS
    py/tools/ — вспомогательный synthetic ingest
    py/tests/ — Python тесты
    backend/src/test/ — Java тесты
    data/ — локальная SQLite база POC
    backend/target/ — build/test/sonar artifacts