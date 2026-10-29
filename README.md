Campus Lost & Found
A full-stack starter for the Campus Lost & Found Management System, built with FastAPI, React, TypeScript, and Vite. Vercel configuration routes /api/* to the backend and all other paths to the frontend.
# Campus Lost & Found

A full-stack starter for the Campus Lost & Found Management System, built with
FastAPI, React, TypeScript, and Vite. Vercel configuration routes `/api/*` to
the backend and all other paths to the frontend.

FastAPI + React Template
FastAPI backend + Vite/React/TypeScript frontend, deployed to Vercel as one project.

backend/    FastAPI app (routes under /api)
frontend/   Vite + React + TypeScript
vercel.json Vercel setup: /api/* goes to backend, everything else to frontend
Requirements
Python 3.10+
Node.js 22+
On macOS/Linux, use python3 instead of python.

Run locally
Backend (terminal 1):

cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
fastapi dev main.py
Frontend (terminal 2):

cd frontend
npm install
npm run dev
Open http://localhost:5173 and click Say hello. Vite forwards /api requests to the backend on port 8000.

To run it the way Vercel does instead, from the project root:

npm install -g vercel
vercel dev -L
Add new Python packages to backend/requirements.txt.

Class exercise
Send an ID, name and email from React to FastAPI and show the reply.

In backend/main.py, uncomment the EXERCISE (part 1) block. Try POST /api/user at http://localhost:8000/docs.
In frontend/src/App.tsx, uncomment <UserForm /> and the UserForm function (EXERCISE (part 2)).
Fill in the form at http://localhost:5173 and click Send.
Try an invalid email (send it from /docs, since the browser blocks it in the form): FastAPI returns 422 without any extra code.

Deploy to Vercel
Push the repo to GitHub.
Go to https://vercel.com/new, import the repo and click Deploy. Keep Root Directory as ./.
Every push to main redeploys automatically. Or deploy from your machine with vercel --prod.

Troubleshooting
"Running scripts is disabled" in PowerShell: run Set-ExecutionPolicy -Scope CurrentUser RemoteSigned.
fastapi not found: activate the virtual environment first.
Request failed: 500 in the app: the backend isn't running.
App at localhost:8000 shows an old version: delete frontend/dist.
Vercel build fails: check Build Logs in the Vercel dashboard, and make sure npm run build works in frontend/.
