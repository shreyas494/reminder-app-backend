# Reminder App Technical Overview

## 1) Project Summary

This project is a full-stack reminder and quotation management system built to track client subscriptions, upcoming expiries, service types, quotations, and related communication workflows.

### Main goals
- Capture client subscription or renewal details
- Automatically track expiry and near-expiry reminders
- Let users manage service types dynamically
- Generate quotations from reminders
- Support authentication and role-based access
- Keep the codebase maintainable and easy to explain

### Tech stack
- **Frontend:** React, React Router, Axios, Tailwind CSS, Material UI, Day.js
- **Backend:** Node.js, Express.js, MongoDB, Mongoose
- **Auth:** JWT + Google login for approved accounts
- **Deployment:** Backend on Render, frontend on Vercel

---

## 2) High-Level Architecture

### Frontend
The frontend is a React single-page app. It handles:
- login/logout
- dashboard
- reminder creation and editing
- service type management
- quotation screens
- admin user management

The frontend sends API requests through a shared Axios instance in [frontend/src/services/api.js](frontend/src/services/api.js).

### Backend
The backend is an Express API that handles:
- authentication
- reminders
- quotations
- service types
- admin user management
- email/payment-related flows
- MongoDB persistence

The backend routes are registered centrally in [backend/config/apiRoutes.js](backend/config/apiRoutes.js).

---

## 3) Frontend Entry Flow

### Startup sequence
1. React starts from [frontend/src/main.jsx](frontend/src/main.jsx)
2. Global providers are loaded:
   - ThemeProvider
   - AuthProvider
   - BrowserRouter
   - LocalizationProvider
3. The app renders [frontend/src/App.jsx](frontend/src/App.jsx)

### Route organization
Frontend routes are centralized in [frontend/src/constants/routes.js](frontend/src/constants/routes.js) so paths are easy to find and explain.

#### Public routes
- `/landing`
- `/login`

#### Protected routes
- `/`
- `/near-expiry`
- `/quotations`
- `/services`
- `/admin/users`
- `/admin/users/create`

### Navigation
- [frontend/src/components/Navbar.jsx](frontend/src/components/Navbar.jsx) handles top-level public navigation
- [frontend/src/components/Layout.jsx](frontend/src/components/Layout.jsx) handles the authenticated app shell and sidebar

---

## 4) Authentication Flow

### Login page flow
The login screen is in [frontend/src/pages/Login.jsx](frontend/src/pages/Login.jsx).

#### When the user logs in:
1. User enters email and password, or uses Google login where allowed.
2. Frontend sends the credentials to the backend API.
3. The request goes through the shared Axios client in [frontend/src/services/api.js](frontend/src/services/api.js).
4. The backend validates the account in [backend/controllers/authController.js](backend/controllers/authController.js).
5. If valid, backend returns:
   - a JWT token
   - basic user info
6. Frontend stores both in localStorage through [frontend/src/context/AuthContext.jsx](frontend/src/context/AuthContext.jsx).
7. After that, protected pages become available.

### What is stored in the browser
- `token` → JWT used for authenticated API calls
- `user` → basic user object for UI display and role checks

### How API authentication works
The Axios interceptor in [frontend/src/services/api.js](frontend/src/services/api.js) automatically adds:
- `Authorization: Bearer <token>`

That means every protected request reaches the backend with the token already attached.

### Backend auth verification
Protected routes use [backend/middleware/authMiddleware.js](backend/middleware/authMiddleware.js).

It:
1. reads the `Authorization` header
2. validates the JWT
3. attaches `req.user` with:
   - `id`
   - `role`
4. blocks requests if token is missing or invalid

### Role-based access
- **user** → normal application access
- **superadmin** → can also access admin user management

---

## 5) Detailed Login Data Flow

### Email/password login
**Frontend:** Login form → API request
**Backend route:** `POST /api/auth/login`

#### Backend processing
In [backend/controllers/authController.js](backend/controllers/authController.js):
- email is normalized
- user is fetched from MongoDB
- disabled accounts are blocked
- superadmin is forced to use Google login
- bcrypt checks the password
- JWT is generated using `JWT_SECRET`

#### Response
The backend returns:
- `token`
- `user: { id, name, email, role }`

#### After login
The frontend stores the values in localStorage and redirects into protected routes.

### Google login
**Backend routes:**
- `POST /api/auth/google`
- `POST /api/auth/google/access`

Google login is used for approved users and the superadmin flow.

---

## 6) Backend Route Map

All API routes are mounted in one place through [backend/config/apiRoutes.js](backend/config/apiRoutes.js).

### Route list
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/google/access`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id/enable`
- `PUT /api/admin/users/:id/disable`
- `PUT /api/admin/users/:id/google/enable`
- `PUT /api/admin/users/:id/google/disable`
- `POST /api/reminders`
- `GET /api/reminders`
- `GET /api/reminders/near-expiry`
- `PUT /api/reminders/:id`
- `PATCH /api/reminders/:id`
- `DELETE /api/reminders/:id`
- `GET /api/quotations`
- `POST /api/quotations/from-reminder/:reminderId`
- `GET /api/quotations/:id`
- `PUT /api/quotations/:id`
- `POST /api/quotations/:id/payment-link`
- `POST /api/quotations/payment-link/:id`
- `POST /api/quotations/:id/pdf`
- `POST /api/quotations/:id/send`
- `DELETE /api/quotations/:id`
- `GET /api/service-types`
- `POST /api/service-types`
- `DELETE /api/service-types/:id`

---

## 7) Reminder Workflow

### Where reminders are created
There are two reminder UIs in the project:
- the dashboard modal flow
- the dedicated reminder page flow in the codebase history

The current dynamic reminder flow uses service types from the backend.

### Create reminder flow
**Frontend** submits reminder data to:
- `POST /api/reminders`

### Fields sent
Typical reminder payload includes:
- `clientName`
- `contactPerson`
- `mobile1`
- `mobile2`
- `email`
- `projectName`
- `serviceType`
- `domainName`
- `activationDate`
- `expiryDate`
- `amount`
- `recurringEnabled`
- `recurringInterval`

### Backend processing
In [backend/controllers/reminderController.js](backend/controllers/reminderController.js):
1. required fields are validated
2. activation/expiry dates are checked
3. amount is validated
4. `reminderAt` is calculated
5. reminder is stored with the logged-in user's ID
6. status is set to `active`

### How it is stored
The reminder is saved in MongoDB in the `reminders` collection through the `Reminder` model.

### Reminder views
- `GET /api/reminders` → dashboard reminder list
- `GET /api/reminders/near-expiry` → near-expiry screen

### Renewal flow
- `PATCH /api/reminders/:id` updates expiry date only
- a renewal history entry is pushed into `renewals`
- `reminderAt` is recalculated
- reminders remain linked to the same client record

---

## 8) Service Type Workflow

### Why this exists
Service types were moved from hardcoded values to user-managed database records.

### UI flow
The Services page lets the user:
- add a new service type
- view existing service types
- delete a service type

### API flow
- `GET /api/service-types` → list service types
- `POST /api/service-types` → create service type
- `DELETE /api/service-types/:id` → remove service type

### Backend storage
Service types are stored in the `ServiceType` collection with:
- `user`
- `name`
- `description`

### Search behavior in reminder forms
When selecting a service type during reminder creation:
1. frontend fetches all service types for the logged-in user
2. user types into the search box
3. list is filtered live
4. matching service types are shown immediately

This makes the experience explainable and scalable.

---

## 9) Quotation Workflow

### Purpose
A quotation is generated from a reminder and stored separately from the reminder itself.

### Main route
- `POST /api/quotations/from-reminder/:reminderId`

### What happens when a quotation is created
In [backend/controllers/quotationController.js](backend/controllers/quotationController.js):
1. reminder is loaded using the reminder ID
2. quotation type is validated
3. company defaults are loaded from environment variables
4. quotation number is generated using the `Counter` collection
5. service type is normalized and mapped to subject/description text
6. pricing is calculated
7. a quotation record is created in MongoDB
8. optional email/PDF/payment link workflows can follow

### Related features
- quotation preview
- PDF generation
- email sending
- payment link generation
- payment status sync

### Stored quotation data
Quotation records are saved in the `quotations` collection and linked to:
- the user
- the reminder

---

## 10) Database Structure

MongoDB is the main data store. Mongoose models define the structure.

### 1. User collection
Model: [backend/models/User.js](backend/models/User.js)

#### Fields
- `name` — required
- `email` — required, unique, lowercase, trimmed
- `password` — required for normal users
- `role` — `user` or `superadmin`
- `isActive` — account status
- `googleEnabled` — whether Google login is allowed

#### Purpose
Stores authentication and access control data.

---

### 2. Reminder collection
Model: [backend/models/Reminder.js](backend/models/Reminder.js)

#### Fields
- `user` → reference to `User`
- `clientName`
- `contactPerson`
- `mobile1`
- `mobile2`
- `email`
- `projectName`
- `serviceType`
- `domainName`
- `activationDate`
- `expiryDate`
- `amount`
- `reminderAt`
- `notificationSent`
- `quotationSent`
- `quotationSentAt`
- `recurringEnabled`
- `recurringInterval`
- `renewals[]`
- `status`

#### Indexes
- `{ user: 1, expiryDate: 1 }`
- `{ user: 1, status: 1 }`

#### Purpose
Main business record for tracking renewal and expiry timelines.

---

### 3. ServiceType collection
Model: [backend/models/ServiceType.js](backend/models/ServiceType.js)

#### Fields
- `user` → reference to `User`
- `name`
- `description`

#### Index
- unique compound index on `{ user: 1, name: 1 }`

#### Purpose
Lets each user manage their own service types dynamically.

---

### 4. Quotation collection
Model: [backend/models/Quotation.js](backend/models/Quotation.js)

#### Fields
- `user` → reference to `User`
- `reminder` → reference to `Reminder`
- `quotationNumber`
- `quotationType`
- `quotationDate`
- recipient/client details
- subject and service description fields
- amounts and GST values
- payment link fields
- company branding fields
- review/sent flags

#### Purpose
Stores generated quotations and payment tracking metadata.

---

### 5. Counter collection
Model: [backend/models/Counter.js](backend/models/Counter.js)

#### Fields
- `name`
- `seq`

#### Purpose
Provides sequential numbering for quotation numbers.

---

## 11) Data Relationships

### User → Reminder
- One user can create many reminders
- Every reminder stores `user`

### User → ServiceType
- One user can create many service types
- Service type names are unique per user

### User → Quotation
- One user can generate many quotations
- Every quotation stores `user`

### Reminder → Quotation
- A quotation is generated from one reminder
- Quotation stores `reminder`

### Counter
- Used globally for numbering, not linked to a single user record

---

## 12) Where Data Goes After Each Action

### After login
- JWT and user profile are stored in localStorage
- frontend auth state is updated
- protected routes become available

### After creating a service type
- data is sent to `POST /api/service-types`
- backend stores it in MongoDB `ServiceType`
- it becomes available in reminder search dropdowns

### After creating a reminder
- data is sent to `POST /api/reminders`
- backend stores it in MongoDB `Reminder`
- dashboard and near-expiry pages read from that collection

### After renewing a reminder
- reminder expiry is updated
- renewal history is appended
- reminder date is recalculated

### After generating a quotation
- reminder data is converted into a quotation record
- quotation number is assigned
- quotation is stored in MongoDB `Quotation`
- optional PDF/email/payment actions can happen next

---

## 13) Important Backend Utilities and Behavior

### Authentication middleware
- validates JWT
- sets `req.user`
- protects reminder/quotation/service-type/admin routes

### CORS and health endpoints
- backend supports local and deployed frontend domains
- `/api/health`, `/alive`, and `/api/ping` are present for uptime/keep-alive checks

### Cron
- reminder cron runs from [backend/cron/reminderCron.js](backend/cron/reminderCron.js)
- used for background reminder-related processing

---

## 14) Important Frontend Files

### Core app files
- [frontend/src/main.jsx](frontend/src/main.jsx)
- [frontend/src/App.jsx](frontend/src/App.jsx)
- [frontend/src/constants/routes.js](frontend/src/constants/routes.js)

### Shared UI
- [frontend/src/components/Navbar.jsx](frontend/src/components/Navbar.jsx)
- [frontend/src/components/Layout.jsx](frontend/src/components/Layout.jsx)
- [frontend/src/components/ProtectedRoute.jsx](frontend/src/components/ProtectedRoute.jsx)

### Pages
- [frontend/src/pages/Landing.jsx](frontend/src/pages/Landing.jsx)
- [frontend/src/pages/Login.jsx](frontend/src/pages/Login.jsx)
- [frontend/src/pages/Dashboard.jsx](frontend/src/pages/Dashboard.jsx)
- [frontend/src/pages/Services.jsx](frontend/src/pages/Services.jsx)
- [frontend/src/pages/NearExpiry.jsx](frontend/src/pages/NearExpiry.jsx)
- [frontend/src/pages/AdminUsers.jsx](frontend/src/pages/AdminUsers.jsx)
- [frontend/src/pages/AdminCreateUser.jsx](frontend/src/pages/AdminCreateUser.jsx)
- [frontend/src/pages/Quotations.jsx](frontend/src/pages/Quotations.jsx)

### Services
- [frontend/src/services/api.js](frontend/src/services/api.js)

### Context
- [frontend/src/context/AuthContext.jsx](frontend/src/context/AuthContext.jsx)
- [frontend/src/context/ThemeContext.jsx](frontend/src/context/ThemeContext.jsx)

---

## 15) Important Backend Files

### Core app files
- [backend/server.js](backend/server.js)
- [backend/config/apiRoutes.js](backend/config/apiRoutes.js)

### Routes
- [backend/routes/authRoutes.js](backend/routes/authRoutes.js)
- [backend/routes/adminRoutes.js](backend/routes/adminRoutes.js)
- [backend/routes/reminderRoutes.js](backend/routes/reminderRoutes.js)
- [backend/routes/quotationRoutes.js](backend/routes/quotationRoutes.js)
- [backend/routes/serviceTypeRoutes.js](backend/routes/serviceTypeRoutes.js)
- [backend/routes/contacts.js](backend/routes/contacts.js)

### Controllers
- [backend/controllers/authController.js](backend/controllers/authController.js)
- [backend/controllers/adminController.js](backend/controllers/adminController.js)
- [backend/controllers/reminderController.js](backend/controllers/reminderController.js)
- [backend/controllers/quotationController.js](backend/controllers/quotationController.js)
- [backend/controllers/serviceTypeController.js](backend/controllers/serviceTypeController.js)

### Models
- [backend/models/User.js](backend/models/User.js)
- [backend/models/Reminder.js](backend/models/Reminder.js)
- [backend/models/Quotation.js](backend/models/Quotation.js)
- [backend/models/ServiceType.js](backend/models/ServiceType.js)
- [backend/models/Counter.js](backend/models/Counter.js)

---

## 16) How to Explain This Project in an Interview

A simple explanation:

> I built a full-stack reminder and quotation system. The user logs in, the app stores a JWT in localStorage, and protected routes are shown only after authentication. Users can create reminders, manage service types, and generate quotations from reminders. Data is stored in MongoDB using separate collections for users, reminders, service types, quotations, and counters. The frontend uses a shared route map and the backend uses a centralized route registry, which makes the code easier to maintain and explain.

---

## 17) Key Improvements I Implemented

- Replaced hardcoded service types with database-driven service types
- Added searchable service type selection
- Added a dedicated Services management page
- Centralized route constants on the frontend
- Centralized route registration on the backend
- Cleaned unused files and simplified the codebase
- Fixed production import issues for deployment

---

## 18) Summary

This project is a practical example of a real-world CRUD + auth + reporting + quotation workflow application. It includes login, permissions, form workflows, database relationships, and deployable API architecture.

It is a good internship project because it shows:
- frontend and backend integration
- MongoDB schema design
- auth and role handling
- production debugging
- code organization and refactoring
- data flow from UI to database and back
