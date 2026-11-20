# Technical Design Document (TDD) — Campus Lost & Found

| Field | Value |
|---|---|
| Product | Campus Lost & Found Management System |
| Releases | MVP — Mid-term; Beta — Final |
| Status | Draft |
| Related docs | [PRD](PRD.md), [SRS](SRS.md) |

## 1. Overview

- **MVP:** A local React + TypeScript frontend uses a FastAPI REST API to manage lost/found reports.
- **Beta:** Add user accounts, a profile dashboard, member/admin roles, security scopes, and deployment.

The repository currently contains the framework scaffold. Report CRUD and Beta features are planned work.

## 2. Technology

| Layer | Technology | Release |
|---|---|---|
| Frontend | React, TypeScript, Vite | MVP |
| Backend | Python, FastAPI | MVP |
| API | JSON REST endpoints | MVP |
| Local data storage | SQLite | MVP |
| Authentication | Signed access tokens and password hashing | Beta |
| Deployment | Vercel or another course-approved host | Beta |

## 3. Architecture

```text
Browser
  └── React + TypeScript frontend
        └── /api requests
              └── FastAPI backend
                    └── Database
```

For local development, Vite proxies `/api` requests to the FastAPI server. In Beta, deployed frontend requests use the configured API routes.


## 4. Project structure

```text
backend/
  main.py             # FastAPI application entrypoint
  models.py           # SQLModel tables and Pydantic schemas
  database.py         # Database engine and session management
  security.py         # Argon2/PBKDF2 password hashing, JWT tokens, and RBAC dependencies
  crud.py             # Database repository queries
  service.py          # Business logic and permission enforcement
  routers/
    items.py          # Report CRUD endpoints
    auth.py           # Registration, login, and logout endpoints
    profile.py        # User profile and password endpoints
    admin.py          # Admin statistics, roles, and user management

frontend/
  src/
    App.tsx           # Root application state and navigation
    api.ts            # REST API client functions
    types.ts          # TypeScript interfaces
    components/       # Reusable UI components (Header, FilterBar, ItemCard, ItemList, Modals)
    pages/            # Application pages (LoginPage, SignupPage, ProfilePage, AdminPage)

docs/
  01-prd.md
  02-srs.md
  03-tdd.md
```

Keep the structure modular and separated by layer.


## 5. Data model


### Report — MVP


| Field | Description |
| --- | --- |
| `id` | Unique report identifier |
| `type` | `lost` or `found` |
| `title` | Short item title |
| `description` | Item details |
| `category` | Item category |
| `location` | Where it was lost or found |
| `created_at` | Date and time the report was created |



### User — Beta


| Field | Description |
| --- | --- |
| `id` | Unique account identifier |
| `email` | Unique user email |
| `password_hash` | Secure password hash; never returned by the API |
| `role` | `member` or `admin` |


## 6. REST API


All endpoints use the `/api` prefix and JSON.


### MVP endpoints


| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/items` | List reports |
| `POST` | `/api/items` | Create a report |
| `GET` | `/api/items/{id}` | View one report |
| `PUT` | `/api/items/{id}` | Update a report |
| `DELETE` | `/api/items/{id}` | Delete a report |
| `GET` | `/api/health` | Check that the API is running |



The API validates request data and returns appropriate errors, such as `404` for a report that does not exist and `422` for invalid input.


### Beta endpoints


| Method | Path | Purpose |

| `POST` | `/api/auth/register` | Register as a member |
| `POST` | `/api/auth/login` | Log in |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/api/profile` | View the signed-in user's profile |



The existing report endpoints become protected in Beta. The API checks the user's role, required scope, and report ownership before allowing protected actions.


## 7. Security — Beta



- Hash passwords using a maintained password-hashing library.

- Keep signing keys and other secrets in environment configuration.

- Do not allow users to assign themselves the admin role.

- Check permissions in FastAPI for every protected endpoint.

- Return `401` for missing or invalid authentication and `403` for insufficient permissions.

- Use HTTPS for the deployed application.



## 8. Testing



- **MVP:** Test report creation, listing, reading, updating, deletion, and invalid input.

- **MVP:** Verify that the frontend can use the local FastAPI API.

- **Beta:** Test login, roles, scopes, and denied access for unauthorized users.

- **Beta:** Check that the deployed app uses HTTPS and does not expose secrets.

## 9. Deployment and configuration

### MVP — local development

- Run the FastAPI backend locally and the React frontend with Vite.
- Configure Vite to proxy frontend `/api` requests to the local backend.
- Use a local database for report data.
- Keep local environment settings in an untracked `.env` file when needed.

### Beta — deployment

- Deploy the frontend and FastAPI backend using the repository's Vercel
  configuration or another course-approved platform.
- Configure the deployed frontend so API requests reach the backend through
  the `/api` routes.
- Use a persistent database suitable for the hosting platform.
- Serve production traffic over HTTPS.
- Store deployment configuration and secrets in the hosting provider's
  environment settings, not in source code or frontend files.

### Configuration

| Setting | Use | Release |
|---|---|---|
| `DATABASE_URL` | Database connection string | MVP locally; Beta deployment |
| `JWT_SECRET` | Signs and verifies authentication tokens | Beta |
| `FRONTEND_ORIGIN` | Allowed frontend origin, if separate CORS configuration is needed | Beta |

The application should fail clearly when required deployment settings are
missing. Never commit real credentials or secret values to Git.
