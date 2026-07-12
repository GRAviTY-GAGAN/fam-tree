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

# CORS configurations supporting localhost and production domains
origins = [
    # UNCOMMENT the local ports below during local environment development:
    # "http://localhost:3000",
    # "http://127.0.0.1:3000",
    "https://fam-tree-iota.vercel.app",
]

# Allow custom client origin if set in environment config
custom_frontend_url = os.getenv("FRONTEND_URL")
if custom_frontend_url:
    origins.append(custom_frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
