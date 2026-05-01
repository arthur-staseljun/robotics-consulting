# Expense Tracker for Android — Field Expense Management with CRM Sync

> **Turn mobile expense capture into real-time back-office data — without custom integrations.**

Expense Tracker is a native Android application that enables field teams to record expenses on the go and synchronize them instantly with your CRM or backend platform. It eliminates manual data entry delays, reduces financial reporting errors, and provides managers with live expense visibility across all tracked categories.

---

## Business Problem It Solves

| Problem | How this app addresses it |
|---|---|
| Field employees record expenses on paper or in personal notes | Structured mobile input with fixed categories and instant submission |
| Data entry happens hours or days after the fact | Expenses are logged in real time and synced to CRM immediately |
| Finance teams manually aggregate expenses from multiple sources | Automatic totals per category and date — visible on device and in CRM |
| Custom integrations between mobile apps and CRM are expensive | Built-in REST API integration, configurable to any HTTP-based backend |
| Tools are too complex for non-technical staff | Clean, minimal UI with no learning curve |

---

## ROI & KPI Impact

### Time savings
- An employee logging 5 expenses per day manually (paper → spreadsheet → CRM): **~15 min/day** per person
- With this app: **<1 min/day** per person
- For a team of 10: **saves ~100 min/day** in admin overhead

### Error reduction
- Structured categories eliminate ambiguous free-text entries
- Real-time CRM sync removes double-entry between mobile and desktop systems
- Per-type and overall totals are calculated automatically — no spreadsheet formulas to maintain

### Speed to value
- Zero training required for end users
- Configurable for any HTTP-based CRM backend in under 1 hour
- Deployable to any Android device (API 24+, Android 7.0 and above)

---

## What the application does

Expense Tracker gives field employees a fast, structured way to submit expenses and gives managers live visibility into spending — without manual consolidation.

**Employee workflow (mobile):**
1. Open the app
2. Select a date, enter amount and description
3. Choose expense category (Izdevumi / Aktīvi / Materiāls / Other)
4. Tap "Pievienot izdevumu" — expense is saved to device and synced to CRM in seconds

**Manager visibility (CRM/backend):**
- All submitted expenses appear instantly in the central backend
- Organized by category, date, and amount
- Accessible via any CRM-compatible HTTP API client

**Additional app capabilities:**
- Inline edit of any expense entry directly in the history list
- Date-based history filtering (navigate to any past day)
- Real-time per-category and overall totals displayed on screen
- Auto-refresh every 30 seconds pulls latest data from CRM
- Works offline in local-only mode (no server required for standalone use)

---

## Why this is valuable

- **Faster data capture**: field employees can submit expense info in seconds
- **Cleaner financial categorization**: fixed expense types reduce data noise
- **Lower admin overhead**: totals and grouping are calculated automatically
- **CRM-ready integration path**: supports central backend sync via HTTP API
- **Flexible deployment**: can run offline/local (`SharedPreferences`) or remote (`Retrofit` + API)

## CRM Integration (Selling Point)

This app supports direct integration with a CRM-compatible backend API.

### How integration works

- Android app sends create/update operations to backend endpoints under `/api/expenses`
- App periodically refreshes remote data (auto-refresh loop) to keep UI current
- Remote data is mapped into app domain models and shown in the same history/totals UI
- Base URL is configurable for VPS/on-prem hosting

### API operations already supported

- `POST /expenses` - create expense
- `GET /expenses` - list expenses
- `PUT /expenses/{id}` - update expense
- `DELETE /expenses/{id}` - delete expense
- Plus range/type/totals endpoints in the API contract

See implementation in:

- `app/src/main/java/com/robotics/consulting/expensetracker/data/api/ExpenseApiService.kt`
- `app/src/main/java/com/robotics/consulting/expensetracker/data/NetworkExpenseRepository.kt`
- `app/src/main/java/com/robotics/consulting/expensetracker/data/api/RetrofitClient.kt`

## Technology stack

- Kotlin + Jetpack Compose UI
- MVVM with `StateFlow`
- Repository pattern for storage abstraction
- Retrofit + Gson + OkHttp for HTTP integration
- `SharedPreferences` for local persistence mode

## Architecture overview

- `MainActivity` renders Compose UI and wires ViewModel
- `ExpenseViewModel` owns screen state, filtering, validation, and actions
- `ExpenseRepository` defines storage contract
  - `SharedPrefsExpenseRepository` for local mode
  - `NetworkExpenseRepository` for CRM/backend mode
- `model/*` contains domain entities and enums

Key files:

- `app/src/main/java/com/robotics/consulting/expensetracker/MainActivity.kt`
- `app/src/main/java/com/robotics/consulting/expensetracker/ui/ExpenseViewModel.kt`
- `app/src/main/java/com/robotics/consulting/expensetracker/data/ExpenseRepository.kt`
- `app/src/main/java/com/robotics/consulting/expensetracker/data/NetworkExpenseRepository.kt`

## Configuration

Backend URL is injected into `BuildConfig.BACKEND_BASE_URL` from Gradle config.

Default project-level property:

- `gradle.properties` -> `backendBaseUrl=http://204.168.182.220/api/`

You can override it with environment variable at build time:

```bash
BACKEND_BASE_URL="http://your-server/api/" ./gradlew :app:installDebug
```

## Run the application

### Android Studio

1. Open project in Android Studio
2. Wait for Gradle sync
3. Run `app` on emulator or device

### CLI build

```bash
./gradlew :app:assembleDebug
```

### Install on connected device/emulator

```bash
./gradlew :app:installDebug
```

### Helper scripts

```bash
./run-emulator.sh
./run-on-device.sh
```

## Testing

Run unit tests:

```bash
./gradlew :app:testDebugUnitTest
```

## Who should deploy this app

| Buyer profile | Why it fits |
|---|---|
| Construction / site management companies | Capture material and labor expenses on-site, same day |
| Logistics and field service companies | Track vehicle, fuel, and service costs per team member |
| Small-to-mid businesses replacing spreadsheets | Drop-in mobile input for existing accounting or ERP workflows |
| Tech companies building client solutions | Ready Kotlin codebase to white-label and customize per client |

---

## Competitive positioning

Unlike generic expense apps (Expensify, SAP Concur), this solution:
- Is **fully self-hosted** — your data stays in your infrastructure
- Has **no per-seat licensing cost**
- Integrates directly with **your existing CRM or backend** via standard REST API
- Can be **customized** at the source level for specific workflow requirements

---

## Summary

Expense Tracker is a production-ready Android foundation for digitizing field expense operations. It delivers immediate time savings on data entry, eliminates consolidation overhead, and provides a configurable integration layer for any CRM or backend system.

> **Ready to demo on device. Ready to deploy with your backend URL. Ready to extend for any client workflow.**

---

