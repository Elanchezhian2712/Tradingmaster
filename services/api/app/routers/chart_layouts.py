import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps import get_current_user
from app.models.chart import ChartLayout
from app.models.core import User
from app.schemas.chart_layout import ChartLayoutCreate, ChartLayoutOut, ChartLayoutUpdate

router = APIRouter(prefix="/api/chart-layouts", tags=["chart-layouts"])


async def _get_owned_layout(db: AsyncSession, user: User, layout_id: uuid.UUID) -> ChartLayout:
    layout = await db.scalar(select(ChartLayout).where(ChartLayout.id == layout_id, ChartLayout.user_id == user.id))
    if layout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chart layout not found")
    return layout


@router.get("", response_model=list[ChartLayoutOut])
async def list_layouts(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[ChartLayout]:
    result = await db.scalars(select(ChartLayout).where(ChartLayout.user_id == user.id))
    return list(result.all())


@router.post("", response_model=ChartLayoutOut, status_code=status.HTTP_201_CREATED)
async def create_layout(payload: ChartLayoutCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> ChartLayout:
    layout = ChartLayout(user_id=user.id, name=payload.name, layout_type=payload.layout_type, config=payload.config, is_default=payload.is_default)
    db.add(layout)
    await db.commit()
    await db.refresh(layout)
    return layout


@router.patch("/{layout_id}", response_model=ChartLayoutOut)
async def update_layout(
    layout_id: uuid.UUID, payload: ChartLayoutUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> ChartLayout:
    layout = await _get_owned_layout(db, user, layout_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(layout, field, value)
    await db.commit()
    await db.refresh(layout)
    return layout


@router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(layout_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    layout = await _get_owned_layout(db, user, layout_id)
    await db.delete(layout)
    await db.commit()
