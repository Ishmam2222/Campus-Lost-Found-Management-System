# Campus Lost & Found Management System

A course project built with **React + TypeScript** and **FastAPI + Python**.
The project is planned in two small releases so the mid-term demo is usable
locally and the final demo adds authentication, authorization, and deployment.

## Release plan

| Release | Demo | Scope |
| --- | --- | --- |
| **MVP** | Mid-term | Locally running React/TypeScript frontend and FastAPI REST API; create, view, update, and delete lost/found reports. |
| **Beta** | Final | Authentication, member/admin roles and RBAC, user profile dashboard, security scopes/permissions, and deployment. |

The current repository contains the framework scaffold and API connectivity
examples. Report management and the Beta features are planned, not implemented
yet. See [docs/](docs/README.md) for the PRD, SRS, and TDD, including
release-specific requirements.

## Run the scaffold locally

Requirements: Python 3.10+ and Node.js 20.19+ or 22.12+.

Start the API in one terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
fastapi dev main.py
```

Start the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` requests to FastAPI on port
8000. The API documentation is available at <http://localhost:8000/docs>.

## Build and deployment

Build the frontend with `cd frontend; npm run build`. The repository includes
Vercel routing configuration for the frontend and backend; deployment is
planned for Beta.

## Project tracking

- Documentation task: [Issue #2](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/issues/2)
- Documentation pull request: [PR #3](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/pull/3)
