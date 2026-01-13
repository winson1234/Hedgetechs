# Project Documentation

## 1. System Architecture

The project follows a **containerized, event-driven architecture** designed for high-frequency trading and real-time data processing.

**Overview Diagram (Logical):**
```mermaid
graph TD
    Client[Web Client (React)] -->|REST API| Backend[Go Backend]
    Client -->|WebSocket| Backend
    Backend -->|SQL| DB[(PostgreSQL)]
    Backend -->|Pub/Sub & Cache| Redis[(Redis)]
    Backend -->|Auth| Keycloak[Keycloak Identity Provider]
    Backend -->|Market Data| Binance[Binance WebSocket]
    Backend -->|Forex Data| MT5[MT5 Publisher/Redis]
```

**Components:**
- **Frontend**: Single Page Application (SPA) built with React and Vite.
- **Backend**: Monolithic Go service handling API requests, WebSocket streams, and business logic.
- **Database**: PostgreSQL for persistent storage (users, orders, transactions).
- **Cache/Message Bus**: Redis used for session management, fast market data access, and event pub/sub.
- **Identity Provider**: Keycloak for user authentication and management.
- **Market Data Engine**: Hybrid engine consuming data from Binance (Crypto) and Redis (Forex/MT5).

**Environments:**
- **Development**: Docker Compose with local services (`docker-compose.dev.yml`).
- **Production**: (Inferred) Similar containerized setup, likely with external managed database/Redis service.

---

## 2. Tech Stack & Tools

### Backend
- **Language**: Go (v1.24.0)
- **Key Libraries**:
  - `jackc/pgx`: High-performance PostgreSQL driver.
  - `go-redis/redis`: Redis client.
  - `gorilla/websocket`: WebSocket implementation.
  - `Nerzal/gocloak`: Keycloak client.
  - `stripe-go`: Payment processing.

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 5
- **Language**: TypeScript
- **State Management**: Redux Toolkit, React Query (TanStack Query)
- **Styling**: Tailwind CSS
- **Charts**: TradingView Lightweight Charts
- **UI Libraries**: Framer Motion, GSAP, React Hook Form, Zod

### Infrastructure & DevOps
- **Containerization**: Docker & Docker Compose.
- **Database**: PostgreSQL 16.
- **Cache**: Redis 7.
- **Auth**: Keycloak 23.
- **Migrations**: `golang-migrate` (SQL files in `sql-scripts`).

---

## 3. Setup & Installation Guide

**Prerequisites:**
- Docker & Docker Compose
- Go 1.24+ (for local execution without Docker)
- Node.js 18+ (for local frontend dev)

**1. Clone the Repository:**
```bash
git clone <repo-url>
cd Hedgetechs
```

**2. Environment Configuration:**
Copy the example environment file:
```bash
cp .env.example .env
```
Key variables to check:
- `POSTGRES_PASSWORD`: Database password.
- `KEYCLOAK_ADMIN_PASSWORD`: Keycloak admin credentials.
- `JWT_SECRET`: Secret for signing tokens.

**3. Run with Docker Compose:**
This starts Backend, Frontend, Postgres, Redis, and Keycloak.
```bash
docker compose -f docker-compose.dev.yml up --build
```

**4. Database Setup:**
The system typically initializes the schema automatically. If needed, you can run the migration scripts found in `sql-scripts/` or use the provided helper scripts:
```bash
./import-complete-schema.sh
```

**Access Points:**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **Keycloak Console**: http://localhost:8082 (User/Pass: admin/admin)

**Common Issues:**
- **Port Conflicts**: Ensure ports 5432 (Postgres), 6379 (Redis), 8080 (Backend), 8082 (Keycloak) are free.
- **Keycloak Startup**: Keycloak can be slow to start. The backend may fail to connect initially; wait for Keycloak to be healthy.

---

## 4. Folder Structure Explanation

### `cmd/`
Entry points for the application.
- `server/`: Main server entry point (`main.go`).

### `internal/`
Core application logic, not importable by external projects.
- `api/`: HTTP and WebSocket handlers (Controllers).
- `services/`: Business logic layer (e.g., `order_execution_service.go`, `keycloak_service.go`).
- `models/`: Go structs representing database entities.
- `worker/`: Background processors (e.g., `order_processor.go`).
- `middleware/`: HTTP middleware (Auth, CORS, Rate Limiting).
- `infrastructure/`: Database and Redis connection setup.
- `market_data/`: Logic for handling Binance and Forex data streams.

### `frontend/`
React application source code.
- `src/components/`: Reusable UI components.
- `src/features/`: Feature-specific logic (e.g., authentication, trading).
- `src/pages/`: Route components.

### `sql-scripts/`
Database schema definitions and migration files.
- `schema/tables/`: Individual `CREATE TABLE` scripts.

---

## 5. API Documentation

**Base URL**: `/api/v1`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login user (validates with Keycloak) |
| POST | `/auth/register` | Register new user |
| POST | `/auth/forgot-password` | Request password reset OTP |
| POST | `/auth/verify-otp` | Verify OTP |
| POST | `/auth/logout` | Logout (invalidates session) |

### Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounts` | List user's trading accounts |
| POST | `/accounts` | Create new trading account |
| PATCH | `/accounts/metadata` | Update account nickname/color |

### Trading & Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/instruments` | List available trading pairs |
| POST | `/pending-orders` | Create limit/stop order |
| DELETE | `/pending-orders/cancel` | Cancel pending order |
| POST | `/deposit/create-crypto-charge` | Initiate crypto deposit |

### Market Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/forex/quotes` | Get current forex quotes |
| GET | `/forex/klines` | Get historical candle data (chart support) |
| WS | `/ws` | WebSocket for real-time prices and updates |

---

## 6. Database Design

### Key Tables

**`users`**
- **Purpose**: Core user identity.
- **Key Fields**: `user_id` (PK, BigInt), `id` (UUID, Keycloak link), `email`, `kyc_status`, `is_active`.

**`accounts`** (Inferred from code)
- **Purpose**: Trading accounts belonging to a user.
- **Key Fields**: `id`, `user_id`, `balance`, `currency`, `type` (Live/Demo).

**`orders`**
- **Purpose**: Executed or active positions.
- **Key Fields**: `id`, `user_id`, `symbol` (e.g., BTCUSDT), `side` (buy/sell), `amount_base`, `status`, `execution_strategy` (b_book/a_book).

**`pending_orders`**
- **Purpose**: Limit and Stop orders waiting to trigger.
- **Key Fields**: `trigger_price`, `limit_price`.

**`transactions`**
- **Purpose**: Ledger for all balance changes (Deposits, Withdrawals, PnL).
- **Key Fields**: `id`, `account_id`, `type` (deposit/withdrawal/trade), `amount`, `status`.

---

## 7. Authentication & Authorization

The system uses **Keycloak** as the Identity Provider (IdP).

**Login Flow:**
1. Frontend sends credentials to Backend `/api/v1/auth/login`.
2. Backend validates credentials against Keycloak via `gocloak` client.
3. Backend checks local `users` and `pending_registrations` tables to ensure account is approved/active.
4. On success, Backend issues a JWT or session token (verify specific implementation details in `auth.go`).

**Authorization:**
- Middleware `AuthMiddleware` verifies the presence and validity of the Auth Token.
- Role-Based Access Control (RBAC) is supported via Keycloak roles (e.g., Admin vs User).

---

## 8. Business Logic & Critical Flows

### Event-Driven Order Execution
To handle high-frequency price updates without polling:
1. **Source**: Binance (WebSocket) or Redis (Forex) pushes price update.
2. **Ingest**: Main loop receives message and pushes to `OrderProcessor` channel.
3. **Broadcasting**: Message is simultaneously broadcast to WebSocket clients (Frontend) via `Hub`.
4. **Processing**: `OrderProcessor` worker:
   - Updates global Price Cache.
   - Checks for **Liquidations** (Margin calls).
   - Queries `pending_orders` for the specific symbol.
5. **Execution**: If a pending order's `trigger_price` is met:
   - Order is moved from `pending_orders` to `orders`.
   - Trade is executed (Balance deducted/updated).
   - Notification sent to user via WebSocket.

### Deposit Flow (Crypto)
1. User initiates deposit via `/api/v1/deposit/create-crypto-charge`.
2. Backend calls payment provider (e.g., NOWPayments) to generate an address.
3. Backend saves pending transaction in `transactions` table.
4. **Webhook Handling**: Provider calls `/api/v1/crypto/webhook` upon payment.
5. Backend verifies signature, finds the transaction, and updates status to `completed`.
6. User balance is credited atomically.
