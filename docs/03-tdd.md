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

For local development, Vite proxies `/api` requests to the FastAPI server. In Beta, deployed frontend requests use the configured API routes.


## 4. Project structure

Plain text


```
backend/
  main.py             # FastAPI application
  items.py            # Report endpoints and data operations (MVP)
  auth.py             # Authentication and permissions (Beta)

frontend/
  src/
    App.tsx           # Main application
    api.ts            # Calls to the backend
    components/       # Report list and forms

docs/
  PRD.md
  SRS.md
  TDD.md

```


Keep the structure small; split files further only when the implementation needs it.


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
