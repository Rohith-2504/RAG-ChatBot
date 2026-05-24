from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.auth_service import AuthService


router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)

AuthService.initialize_database()


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
async def signup(request: SignupRequest):
    try:
        user = AuthService.signup(
            request.name,
            request.email,
            request.password,
        )

        return {
            "status": "success",
            "user": user,
        }

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.post("/login")
async def login(request: LoginRequest):
    try:
        user = AuthService.login(
            request.email,
            request.password,
        )

        return {
            "status": "success",
            "user": user,
        }

    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
        )
