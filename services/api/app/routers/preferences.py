from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps import get_current_user
from app.models.core import User, UserPreference
from app.schemas.preferences import UserPreferenceOut, UserPreferenceUpdate

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


async def _get_or_create(db: AsyncSession, user_id) -> UserPreference:
    prefs = await db.get(UserPreference, user_id)
    if prefs is None:
        prefs = UserPreference(user_id=user_id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


@router.get("", response_model=UserPreferenceOut)
async def get_preferences(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> UserPreference:
    return await _get_or_create(db, user.id)


@router.patch("", response_model=UserPreferenceOut)
async def update_preferences(payload: UserPreferenceUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> UserPreference:
    prefs = await _get_or_create(db, user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)
    await db.commit()
    await db.refresh(prefs)
    return prefs
