# Campus Lost & Found

A full-stack starter for the Campus Lost & Found Management System, built with
FastAPI, React, TypeScript, and Vite. Vercel configuration routes `/api/*` to
the backend and all other paths to the frontend.

## Requirements

- Python 3.10+
- Node.js 20.19+ or 22.12+

## Run locally

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

Open <http://localhost:5173>. The Vite dev server forwards `/api` requests to
FastAPI on port 8000. The API also provides interactive documentation at
<http://localhost:8000/docs>.

## Build and deploy

Build the frontend with `cd frontend; npm run build`. To deploy, import this
repository into Vercel and keep the project root set to `./`; `vercel.json`
configures the frontend and backend services.

The initial `/api/health` and `/api/hello` routes are connectivity examples.
Add application models, persistence, and lost-and-found workflows as the
project grows.
