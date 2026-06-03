# EPR Storage Manager

Web app for managing EPR storage facility.

## Setup (one time)

Open Terminal and run these commands in order:

```bash
# 1. Go to the project folder
cd "path/to/epr-storage"

# 2. Install backend dependencies
cd server
npm install
cd ..

# 3. Install frontend dependencies
cd client
npm install
cd ..
```

## Run (every time you want to start)

Open Terminal and run:

```bash
cd "path/to/epr-storage"

# Start backend
node server/src/server.js &

# Start frontend
cd client
npx vite --host
```

Then open **http://localhost:5173** in your browser.
Password: **admin123**

## Requirements

- **Node.js** — Download from https://nodejs.org (v18 or newer)
- **npm** — Comes with Node.js

## Pages

- **Login** — Password: `admin123`
- **Dashboard** — Storage overview & pricing
- **Floor Plan** — Interactive map with walkways
- **Assignments** — Job management
- **Operations** — Truck-to-storage wizard
