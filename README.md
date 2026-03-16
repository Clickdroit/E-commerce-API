# E-commerce API

A complete REST API for managing an end-to-end e-commerce system. Built with Node.js, Express, PostgreSQL, and Redis. Covers everything an online store needs on the server side: authentication, real-time inventory, Stripe payments, shipping tracking, async background jobs, and structured logging.

---

## Features

### Authentication & Security
- User registration and login with **JWT** access tokens
- **Refresh token** rotation stored in PostgreSQL
- **Rate limiting** (general, auth-specific, strict tiers) via `express-rate-limit`
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc.)
- Password hashing with **bcrypt** (12 rounds)

### Real-time Inventory Management
- Per-unit stock tracking for every product
- **PostgreSQL `SELECT FOR UPDATE`** prevents concurrent over-selling: two simultaneous requests for the last item — only one succeeds, the other receives a clean error
- **WebSocket** broadcasts stock updates in real time — clients subscribe to specific product IDs and receive changes instantly

### Payments via Stripe
- Create **Payment Intents** tied to orders
- Stripe **Webhook** handler: `payment_intent.succeeded` → confirm order + create shipment + queue emails; `payment_intent.payment_failed` → cancel order + release stock; `charge.refunded` → mark order as refunded
- Admin-triggered **refunds**
- All events logged

### Shipping & Tracking
- Shipment created automatically on payment confirmation
- Auto-generated tracking numbers (`TRK-XXXXXXXX-XXXXXXXX`)
- Status lifecycle: `preparing → shipped → in_transit → delivered`
- Public endpoint to track by tracking number
- Status updates triggerable by admin

### Async Background Jobs (BullMQ + Redis)
- **Email job**: queue order confirmation and shipment notification emails (extensible with any SMTP/Resend/SendGrid provider)
- **Shipment job**: carrier status polling and delivery status updates
- **Cleanup job**: expire pending orders older than 24 hours; purge expired refresh tokens

### Logging & Health
- Structured logging with **Winston** (console + file transports)
- Every HTTP request traced (method, path, status, duration, IP)
- `GET /api/v1/health` — real-time status of API, PostgreSQL, and Redis including latency

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Database | PostgreSQL 15 |
| Cache / Queues | Redis 7 + ioredis + BullMQ |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Payments | Stripe |
| Real-time | WebSocket (ws) |
| Validation | Joi |
| Logging | Winston |

---

## Project Structure

```
├── src/
│   ├── app.js                    # Express app configuration
│   ├── server.js                 # HTTP server, WebSocket, workers, graceful shutdown
│   ├── config/
│   │   ├── database.js           # PostgreSQL pool
│   │   ├── redis.js              # ioredis client
│   │   └── stripe.js             # Stripe client
│   ├── middleware/
│   │   ├── auth.js               # JWT authenticate / optionalAuth
│   │   ├── rateLimiter.js        # Rate limit tiers
│   │   └── errorHandler.js       # Centralized error + 404 handlers
│   ├── models/
│   │   ├── index.js              # Database schema initialization
│   │   ├── user.js               # User queries
│   │   ├── product.js            # Product queries + stock ops
│   │   ├── order.js              # Order + order_items queries
│   │   └── shipment.js           # Shipment queries
│   ├── routes/
│   │   ├── index.js              # /api/v1 router
│   │   ├── auth.js               # /auth
│   │   ├── products.js           # /products
│   │   ├── orders.js             # /orders
│   │   ├── payments.js           # /payments
│   │   ├── shipments.js          # /shipments
│   │   └── health.js             # /health
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── paymentController.js
│   │   └── shipmentController.js
│   ├── services/
│   │   ├── inventoryService.js   # Stock reservation with PG transactions
│   │   ├── paymentService.js     # Stripe wrapper
│   │   ├── shipmentService.js    # Shipment creation + tracking
│   │   └── emailService.js       # Enqueue emails
│   ├── jobs/
│   │   ├── queue.js              # BullMQ queues + connection
│   │   ├── emailJob.js           # Email worker
│   │   ├── shipmentJob.js        # Shipment status worker
│   │   └── cleanupJob.js         # Cleanup worker
│   ├── websocket/
│   │   └── inventorySocket.js    # WebSocket server + broadcast
│   └── utils/
│       ├── logger.js             # Winston logger
│       └── generateTracking.js   # Tracking number generator
├── db/
│   └── schema.sql                # PostgreSQL schema (all tables + indexes)
├── docker-compose.yml            # PostgreSQL + Redis for local dev
├── .env.example
└── package.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for PostgreSQL + Redis), **or** local installs

### 1. Clone and install
```bash
git clone https://github.com/Clickdroit/E-commerce-API.git
cd E-commerce-API
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start infrastructure
```bash
docker-compose up -d
```
This starts PostgreSQL 15 on port 5432 and Redis 7 on port 6379. The schema is applied automatically on first boot.

### 4. Start the API
```bash
# Development (with hot-reload)
npm run dev

# Production
npm start
```

The server listens on `http://localhost:3000` by default.

---

## API Endpoints

### Authentication — `/api/v1/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | — | Register a new user |
| POST | `/login` | — | Login, receive JWT + refresh token |
| POST | `/refresh` | — | Rotate refresh token, get new JWT |
| POST | `/logout` | ✓ | Invalidate refresh token |
| GET | `/me` | ✓ | Get current user profile |

### Products — `/api/v1/products`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | List products (paginated, searchable) |
| GET | `/:id` | — | Get product by ID |
| POST | `/` | admin | Create product |
| PUT | `/:id` | admin | Update product |
| PATCH | `/:id/stock` | admin | Update stock (broadcasts via WebSocket) |

### Orders — `/api/v1/orders`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | ✓ | Create order (reserves stock atomically) |
| GET | `/` | ✓ | List current user's orders |
| GET | `/:id` | ✓ | Get order details |
| DELETE | `/:id` | ✓ | Cancel order (releases stock) |

### Payments — `/api/v1/payments`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/intent` | ✓ | Create Stripe Payment Intent for an order |
| POST | `/webhook` | Stripe sig | Handle Stripe webhook events |
| POST | `/:orderId/refund` | admin | Refund an order |

### Shipments — `/api/v1/shipments`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/track/:trackingNumber` | — | Track shipment publicly |
| GET | `/order/:orderId` | ✓ | Get shipment for an order |
| PATCH | `/:id/status` | admin | Update shipment status |

### Health — `/api/v1/health`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | API, database, and Redis health check |

---

## WebSocket

Connect to `ws://localhost:3000` and send:

```json
{ "type": "subscribe", "productId": "<uuid>" }
```

You will receive real-time stock updates:

```json
{ "type": "stock_update", "productId": "<uuid>", "newStock": 42, "timestamp": "2024-01-01T00:00:00.000Z" }
```

---

## Response Format

All responses follow a consistent structure:

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": { "message": "...", "code": "ERROR_CODE", "details": [...] } }
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | — |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | — |
| `JWT_EXPIRES_IN` | JWT expiry | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `STRIPE_SECRET_KEY` | Stripe secret key | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |
| `BASE_URL` | API base URL | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `*` |

---

## Roadmap (v2+)

**Short term**
- Advanced role system (admin, seller, customer)
- Multi-vendor support
- Promo codes and discounts
- Advanced pagination and product filters
- CSV export for orders

**Medium term**
- Transactional email templates (Resend / SendGrid)
- Analytics dashboard (revenue, top products, conversion rate)
- Returns and dispute management
- Multi-currency support

**Long term**
- Microservices architecture
- GraphQL in parallel to REST
- Product recommendation engine
- Multi-payment provider support (PayPal, Apple Pay)
- Cloud deployment with automated CI/CD
