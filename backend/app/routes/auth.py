import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.db import get_session
from app.models import User
from app.config import settings
from app.auth_utils import create_access_token, get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

class GoogleLoginRequest(BaseModel):
    credential: str

@router.post("/google")
async def google_auth(
    payload: GoogleLoginRequest,
    session: Session = Depends(get_session)
):
    credential = payload.credential
    user_email = ""
    user_name = ""
    user_google_id = ""
    user_picture = None

    # Check for Dev Bypass
    if credential == "dev_bypass_mock_credential":
        if settings.GOOGLE_CLIENT_ID != "":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bypass login is only permitted in development mode (GOOGLE_CLIENT_ID empty)."
            )
        # Populate Mock Dev User details
        user_google_id = "mock_google_id_developer_12345"
        user_email = "developer@familyflow.local"
        user_name = "Local Developer"
        user_picture = "https://res.cloudinary.com/demo/image/upload/v1614723049/sample.jpg"
    else:
        # Real Google Auth Validation
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google OAuth is not configured on this server. Use developer bypass."
            )
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google token"
                )
            token_info = response.json()
            
            # Verify client ID audience match
            aud = token_info.get("aud")
            if aud != settings.GOOGLE_CLIENT_ID:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Audience mismatch. Token issued for another client ID."
                )
                
            user_google_id = token_info.get("sub")
            user_email = token_info.get("email")
            user_name = token_info.get("name", "Google User")
            user_picture = token_info.get("picture")
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification error: {str(e)}"
            )

    # Upsert the User record in database
    db_user = session.exec(select(User).where(User.google_id == user_google_id)).first()
    
    if not db_user:
        db_user = User(
            email=user_email,
            google_id=user_google_id,
            name=user_name,
            picture_url=user_picture
        )
        session.add(db_user)
    else:
        # Update user name/photo changes from Google
        db_user.name = user_name
        db_user.picture_url = user_picture
        session.add(db_user)
        
    session.commit()
    session.refresh(db_user)

    # Generate backend JWT session token
    access_token = create_access_token(data={"sub": str(db_user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "picture_url": db_user.picture_url
        }
    }

@router.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture_url": current_user.picture_url
    }
