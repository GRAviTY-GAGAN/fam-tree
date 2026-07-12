import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.config import settings

# Import API routers
from app.routes import auth, trees, people, relationships, media

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables on startup
    init_db()
    yield

app = FastAPI(
    title="FamilyFlow API",
    description="Backend API for FamilyFlow Mobile-First Family Tree Builder",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configurations for Next.js local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoint routers
app.include_router(auth.router)
app.include_router(trees.router)
app.include_router(people.router)
app.include_router(relationships.router)
app.include_router(media.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to FamilyFlow API. Version 1.0.0 is running."}

@app.get("/healthinfo")
def health_check():
    return {
        "status": "healthy",
        "google_auth_configured": bool(settings.GOOGLE_CLIENT_ID),
        "cloudinary_configured": bool(settings.CLOUDINARY_URL)
    }
