import os
import uuid
import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from app.config import settings
from app.auth_utils import get_current_user
from app.models import User

router = APIRouter(prefix="/api/v1/media", tags=["Media Upload"])

# Initialize Cloudinary SDK if configured
cloudinary_configured = False
if settings.CLOUDINARY_URL:
    try:
        import urllib.parse
        url = urllib.parse.urlparse(settings.CLOUDINARY_URL)
        cloudinary.config(
            cloud_name=url.hostname,
            api_key=url.username,
            api_secret=url.password
        )
        cloudinary_configured = True
    except Exception as e:
        print(f"Error configuring Cloudinary SDK: {e}")

@router.post("/upload")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: JPEG, PNG, GIF, WEBP"
        )

    # Cloudinary is mandatory; no local file system fallback is allowed
    if not settings.CLOUDINARY_URL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Media uploading is disabled because Cloudinary is not configured. Please define CLOUDINARY_URL in the backend environment."
        )

    try:
        # Parse credentials from settings.CLOUDINARY_URL
        import urllib.parse
        url = urllib.parse.urlparse(settings.CLOUDINARY_URL)
        
        # Upload file stream directly to Cloudinary with explicit config arguments
        result = cloudinary.uploader.upload(
            file.file,
            folder="familyflow",
            resource_type="image",
            cloud_name=url.hostname,
            api_key=url.username,
            api_secret=url.password
        )
        return {
            "url": result.get("secure_url"),
            "provider": "cloudinary"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cloudinary upload failed: {str(e)}"
        )
