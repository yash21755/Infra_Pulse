# Infra Pulse - Frontend Web Application

Welcome to the frontend architecture documentation for the Infra Pulse project. As a senior engineer joining or reviewing this codebase, this document provides a comprehensive overview of the inner workings, configuration, and structural philosophy of the React-based client application.

## Overview
This is a modern, highly responsive React Single Page Application (SPA) built using Vite for incredibly fast Hot Module Replacement (HMR) and optimized builds. The frontend serves as the primary interface for users reporting infrastructure issues and for administrators managing the feed.

The application leverages the experimental React Compiler (`@vitejs/plugin-react` combined with `@rolldown/plugin-babel`) for advanced automatic memoization, reducing the need for manual `useMemo` or `useCallback` hooks and significantly improving rendering performance.

## Tech Stack
* **Framework:** React 18+
* **Build Tool:** Vite
* **Styling:** Tailwind CSS (configured via `tailwind.config.js` and `postcss.config.js`)
* **Routing:** React Router (configured in `src/`)
* **State Management / Context:** Context API (e.g., ThemeContext for dark mode)

## Port Routing & Proxy Configuration
By default, the Vite dev server runs on **Port 5173** (or the next available port). 
To avoid CORS issues during local development and simplify deployment, we have a built-in proxy configured in `vite.config.ts`. 

All outgoing requests starting with `/api` or `/uploads` are automatically proxied to the Node.js backend:
* `/api/*` ➔ `http://localhost:5000/api/*`
* `/uploads/*` ➔ `http://localhost:5000/uploads/*`

This means frontend API calls can just be `fetch('/api/issues')` without needing to hardcode the backend URL.

## Folder Structure
```text
frontend/
├── public/                 # Static assets (favicon, raw icons) not processed by Vite
├── src/                    # Source code
│   ├── components/         # Reusable UI components (buttons, modals, layout wrappers)
│   ├── pages/              # Route-level components (Home, Issue Report, Admin Dashboard)
│   ├── context/            # React Context providers (ThemeContext, AuthContext)
│   ├── App.tsx / App.jsx   # Root application component containing routing logic
│   └── index.css           # Global Tailwind CSS imports
├── eslint.config.js        # ESLint configuration for code quality
├── postcss.config.js       # PostCSS config required by Tailwind
├── tailwind.config.js      # Tailwind theme extensions and utility classes
├── tsconfig.json           # TypeScript compilation context
└── vite.config.ts          # Vite build and proxy configuration
```

## Detailed Workings
1. **Theming & Styling:** We rely heavily on Tailwind CSS. The configuration (`tailwind.config.js`) defines custom tokens, including our dynamic dark mode which is managed by a `ThemeContext` toggling a `dark` class on the root `<html>` element.
2. **Issue Submission Flow:** When a user submits an issue, the form data (including `multipart/form-data` for image uploads) is sent to `/api/issues/create`.
3. **Feed Rendering:** The issue feed fetches from `/api/issues/`. This feed is automatically sorted by the Python Priority API (which the Node backend communicates with), ensuring the highest priority items are rendered at the top.

## Scripts
* `npm install` - Install dependencies
* `npm run dev` - Start local development server (with HMR)
* `npm run build` - Create a production bundle in `dist/`
* `npm run lint` - Run ESLint over the `src/` directory
