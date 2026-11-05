# Pizza Delivery Full-Stack Application — Starter

A starter project for a React + Express pizza ordering app.

## Included
- React/Vite frontend with a pizza builder: 5 bases, 5 sauces, cheese, multiple vegetables
- Express API: menu, create/list orders, update order status, demo payment action
- Admin demo page: inventory stock editing and order status management
- Polling-based order status refresh every 5 seconds
- `.env.example` and optional MongoDB connection scaffold

## Run locally
Requirements: Node.js 20+ and npm.

### Backend
Open terminal in `backend`:
```bash
npm install
copy .env.example .env
npm run dev
```
On macOS/Linux use `cp .env.example .env`.

### Frontend
Open a second terminal in `frontend`:
```bash
npm install
npm run dev
```
Open http://localhost:5173. API runs at http://localhost:5000.

## Important limitations
This is a learning/demo starter, NOT a production-ready application:
- Orders and inventory are currently in memory and reset when the backend restarts.
- MongoDB connection is scaffolded but persistence/models are not implemented yet.
- Admin page is not protected by real admin authentication.
- The payment action only simulates success; it does not charge money or securely integrate Razorpay.
- Email verification, password reset, JWT authentication, automated stock deductions, node-cron email alerts, and production hardening remain to be implemented.

Never publish secrets. For real Razorpay integration, create orders on the server and verify the payment signature server-side.
