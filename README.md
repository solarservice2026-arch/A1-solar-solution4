# A1 Solar Solution Platform (MERN Stack)

Standalone MERN (MongoDB, Express, React, Node.js) platform for A1 Solar Solution: responsive public website, CRM, customer/staff portals, REST API, and MongoDB backend.

## Stack

React, Vite, Node.js, Express, MongoDB (Mongoose), Zod, and JavaScript (ES Modules / JSX).

## Quick start

1. Create a `.env` file with `MONGODB_URI` and `JWT_SECRET`.
2. Run `npm install`.
3. Run `npm run dev` to start both frontend (`http://localhost:5173`) and backend (`http://localhost:5000`).

## Commands

- `npm run dev` — Run web frontend and Express backend concurrently
- `npm run build` — Build web frontend for production
- `npm start` — Start production backend API server

## Workspace Structure

- `apps/web` — React + Vite frontend application (JavaScript JSX)
- `apps/api` — Node.js + Express + Mongoose REST API (JavaScript ES Module)
- `packages/validation` — Shared Zod validation schemas
