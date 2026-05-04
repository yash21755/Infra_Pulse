# Infra Pulse - Node.js Backend Server

Welcome to the backend architecture documentation for Infra Pulse. This directory contains the primary Express.js web server that acts as the central orchestrator for the platform. It handles user authentication, connects to MongoDB, and acts as a gateway proxying complex Machine Learning tasks to the dedicated Python Microservices.

## Architecture & Workings
This is a standard Node.js Express server utilizing a layered architectural pattern (Routes ➔ Controllers ➔ Models). 
However, it diverges from standard CRUD apps by deeply integrating with external Python ML APIs for Redundancy detection and Prioritization.

When an issue is reported:
1. The **Geospatial API** translates location data to a `building_id`.
2. The **Redundancy API** evaluates the issue text/image against existing issues in that `building_id`.
3. If unique, it is saved to MongoDB.
4. The **Priority API** updates the algorithmic feed ranking.

## Port Configuration & Network
* **Default Port:** `5000` (Defined by `PORT` in `.env` or defaulting to 5000 in `server.js`).
* **Python Microservice Dependencies:**
  * Geospatial API runs on port `8001`
  * Redundancy API runs on port `8002`
  * Priority API runs on port `8003`

The Express server makes internal HTTP calls to these ports. Ensure the Python services are running alongside this Node server.

## Security & Middleware
Configured in `server.js`, we employ robust, production-ready middleware:
* **Helmet:** Secures HTTP headers.
* **CORS:** Controlled via `CORS_ORIGIN` in the `.env` file to prevent unauthorized access.
* **Express Rate Limit:** Prevents DDoS/brute-force attacks (`RATE_LIMIT_WINDOW` and `RATE_LIMIT_MAX`).
* **Cookie Parser:** For handling secure, HttpOnly JWT tokens for authentication.
* **Morgan:** For detailed HTTP request logging.

## Folder Structure
```text
backend/
├── config/                 # DB connections (db.js) and config loaders
├── controllers/            # Core business logic
│   ├── authController.js   # Login/Signup logic
│   ├── issueController.js  # Issue creation, Python API orchestration
│   ├── notificationController.js
│   └── userController.js
├── middleware/             # Custom Express middlewares
│   └── errorHandler.js     # Global error catching/formatting
├── models/                 # Mongoose Schemas (User, Issue, Notification)
├── routes/                 # Express Router definitions
│   ├── authRoutes.js
│   ├── issueRoutes.js      # Protects routes and links to controllers
│   ├── notificationRoutes.js
│   └── userRoutes.js
├── uploads/                # Directory for local image storage (served statically)
├── .env                    # Environment variables (DB URI, Secrets)
└── server.js               # Application entry point
```

## Detailed Solutions
* **File Uploads:** Local image uploads are handled (likely via `multer`) and saved into the `/uploads` directory. `server.js` statically serves this directory via `app.use('/uploads', express.static('uploads'));` so the frontend can retrieve images easily.
* **Error Handling:** Instead of throwing raw stack traces to the client, all routes wrap asynchronous code in try/catch blocks (or use an `express-async-handler`) and forward errors to the `errorHandler.js` middleware, guaranteeing a consistent JSON error format.

## Running the Server
1. Ensure MongoDB is running and `MONGO_URI` is set in `.env`.
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev` (assumes `nodemon`) or `node server.js`
