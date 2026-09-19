# Disaster Management System

A full-stack disaster response platform for monitoring incidents, sending alerts, and coordinating emergency information across an admin dashboard, backend API, and mobile app.

## Overview

This project contains three main parts:

- Admin Web App: React + TypeScript + Vite dashboard for managing disaster events, guides, logs, and admin users.
- Backend API: Node.js + Express application that exposes authenticated admin APIs and serves the mobile app and web dashboard.
- Mobile App: Flutter application for public users and responders with alerts, map, SOS, localized guidance, and notifications.

## Project Structure

```text
Disaster-Management/
├── admin-web/            # React admin dashboard
│   ├── src/
│   ├── package.json
│   ├── .env
│   └── vite.config.ts
├── backend/              # Express API
│   ├── src/
│   ├── tests/
│   ├── package.json
│   ├── seed-admin.js
│   └── seed-guides.js
├── disaster_app/         # Flutter mobile app
│   ├── lib/
│   ├── android/
│   ├── pubspec.yaml
│   └── README.md
└── README.md             # Project overview
```

## Tech Stack

### Admin Web
- React 19
- TypeScript
- Vite
- React Router
- Axios
- Zustand
- Leaflet / react-leaflet

### Backend
- Node.js 18+
- Express 4
- MongoDB with Mongoose
- JWT authentication
- Helmet, CORS, rate limiting
- Firebase Admin SDK

### Mobile App
- Flutter
- Dart
- Firebase Core / Firebase Messaging
- flutter_map
- geolocator
- audioplayers
- shared_preferences
- intl for localization

## Features

### Admin web dashboard
- Admin login
- Dashboard overview
- Disaster event creation and listing
- Guide management
- Logs and audit tracking
- Protected routes using JWT-based authentication

### Backend API
- Authentication endpoints
- Event management APIs
- User registration and profile endpoints
- Safety guide endpoints
- Log and alert handling
- MongoDB persistence
- Firebase push support
- Health check endpoint

### Mobile app
- Disaster alerts and alerts feed
- Map view for area-based information
- SOS features
- Localized guides and support content
- Sound and notification services
- Settings and language switching

## Prerequisites

### For admin web
- Node.js 18 or newer
- npm

### For backend
- Node.js 18 or newer
- MongoDB instance
- Optional: Firebase service account JSON file

### For mobile app
- Flutter SDK 3.11.1 or newer
- Android Studio / Xcode for device builds
- Android emulator or physical device

## Environment Setup

### 1) Admin Web
The frontend reads its API URL from the `.env` file:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

You can keep that value as-is for local development.

### 2) Backend
Create a `.env` file inside `backend/` with values similar to:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/disaster_management
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
ADMIN_ORIGIN=http://localhost:5173
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
```

Notes:
- `MONGO_URI` is required for database connection.
- `JWT_SECRET` is required for protected admin APIs.
- `FIREBASE_SERVICE_ACCOUNT_PATH` is optional. If it is missing, Firebase push notification setup is skipped gracefully.

### 3) Mobile App
Configure your Flutter environment and install dependencies:

```bash
cd disaster_app
flutter pub get
```

If Firebase is configured, ensure the app has the required Firebase setup files in the Android project.

## Running the Project

### Start the backend

```bash
cd Disaster-Management/backend
npm install
npm run dev
```

Backend health check:

```text
http://localhost:5000/health
```

### Start the admin web app

```bash
cd Disaster-Management/admin-web
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

### Run the mobile app

```bash
cd Disaster-Management/disaster_app
flutter pub get
flutter run
```

## Important API Routes

### Authentication
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/seed-admin`

### Events
- `GET /api/events`
- `POST /api/events`
- `GET /api/events/:id`
- `PUT /api/events/:id`
- `DELETE /api/events/:id`

### Guides
- `GET /api/guides`
- `POST /api/guides`

### Users
- `POST /api/users/register`
- `GET /api/users/:id`

### Logs
- `GET /api/logs`
- `POST /api/logs`

## Seeding Initial Admin Data

The backend includes a seeding script for an initial admin account:

```bash
cd Disaster-Management/backend
node seed-admin.js
```

You can also create the first admin through the API route:

```text
POST /api/auth/seed-admin
```

## Testing

### Backend tests

```bash
cd Disaster-Management/backend
npm test
```

The project includes Jest tests for backend behavior.

## Notes

- The backend allows the admin web app at `http://localhost:5173` and common localhost origins for local development.
- Firebase is initialized if a valid service account path is supplied; otherwise notifications are disabled.
- The admin web app is protected by JWT login and route guards.

## Recommended Development Flow

1. Start MongoDB.
2. Start the backend API.
3. Start the admin web app.
4. Start the mobile app when testing Android/iOS flows.
5. Use the admin dashboard to create events and guides.

## Contributors

| Contributor Name | Role / Contribution |
| --- | --- |
| <a href="https://github.com/HarshAnand143">Harsh Anand</a> | - Designed and implemented the admin web login page UI. <br> - Worked on the admin web frontend. <br> - Prepared SRS documentation at each project level. |
| <a href="https://github.com/MeetKaushikSharma">Kaushik Sharma</a> | - Completed the remaining project development work. <br> - Contributed to core implementation across the project. <br> - handled major remaining project tasks beyond the admin login UI. |

## License

This project is currently intended for internal project use and is not published as a public package.
