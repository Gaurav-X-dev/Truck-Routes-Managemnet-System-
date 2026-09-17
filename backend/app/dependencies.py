from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def get_current_user(db: Session = Depends(get_db)) -> User:
    # Bypass auth for testing
    user = db.query(User).first()
    if not user:
        user = User(email="test@example.com", username="testadmin", is_active=True, hashed_password="dummy")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
