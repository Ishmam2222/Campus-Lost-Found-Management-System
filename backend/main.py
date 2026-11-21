import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session

from database import create_db_and_tables, engine
from routers.admin import router as admin_router
from routers.auth import router as auth_router
from routers.groups import router as groups_router
from routers.items import router as items_router
from routers.profile import router as profile_router
import service

logger = logging.getLogger("campus_lost_found")

app = FastAPI(
    title="Campus Lost & Found API",
    description="Secure multi-user REST API with JWT authentication, RBAC, recovery groups, and admin audit dashboard.",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Restrict CORS to configured frontend origin and local development ports
FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN", "https://campus-lost-found-management-system.vercel.app"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Register modular feature routers
app.include_router(items_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(groups_router)
app.include_router(admin_router)

# Initialize database tables and seed default test accounts on import
try:
    create_db_and_tables()
    with Session(engine) as session:
        service.seed_initial_data(session)
except Exception as e:
    logger.error("Failed to initialize database tables: %s", e)


# Never send stack traces or internal database details to the client (Section 2.4)
@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    logger.error(
        "Unhandled error on %s %s", request.method, request.url.path, exc_info=exc
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    """Health check endpoint to verify backend status."""
    return {"status": "ok"}


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIR.is_dir():
    app.frontend("/", directory=FRONTEND_DIR)
