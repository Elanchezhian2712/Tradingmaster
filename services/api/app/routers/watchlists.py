import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.deps import get_current_user
from app.models.core import User
from app.models.watchlist import Watchlist, WatchlistSymbol
from app.schemas.watchlist import WatchlistCreate, WatchlistOut, WatchlistSymbolCreate, WatchlistSymbolReorder

router = APIRouter(prefix="/api/watchlists", tags=["watchlists"])


async def _get_owned_watchlist(db: AsyncSession, user: User, watchlist_id: uuid.UUID) -> Watchlist:
    watchlist = await db.scalar(
        select(Watchlist).options(selectinload(Watchlist.symbols)).where(Watchlist.id == watchlist_id, Watchlist.user_id == user.id)
    )
    if watchlist is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return watchlist


@router.get("", response_model=list[WatchlistOut])
async def list_watchlists(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[Watchlist]:
    result = await db.scalars(select(Watchlist).options(selectinload(Watchlist.symbols)).where(Watchlist.user_id == user.id))
    return list(result.all())


@router.post("", response_model=WatchlistOut, status_code=status.HTTP_201_CREATED)
async def create_watchlist(payload: WatchlistCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> Watchlist:
    watchlist = Watchlist(user_id=user.id, name=payload.name)
    db.add(watchlist)
    await db.commit()
    await db.refresh(watchlist, attribute_names=["symbols"])
    return watchlist


@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(watchlist_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    watchlist = await _get_owned_watchlist(db, user, watchlist_id)
    await db.delete(watchlist)
    await db.commit()


@router.post("/{watchlist_id}/symbols", response_model=WatchlistOut, status_code=status.HTTP_201_CREATED)
async def add_symbol(
    watchlist_id: uuid.UUID, payload: WatchlistSymbolCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> Watchlist:
    watchlist = await _get_owned_watchlist(db, user, watchlist_id)
    if any(s.symbol == payload.symbol for s in watchlist.symbols):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Symbol already in watchlist")

    next_position = len(watchlist.symbols)
    db.add(WatchlistSymbol(watchlist_id=watchlist.id, symbol=payload.symbol, exchange=payload.exchange, position=next_position))
    await db.commit()
    # `watchlist.symbols` was already loaded above, and expire_on_commit=False means a
    # plain re-query would hand back the same identity-mapped, now-stale collection —
    # refresh it explicitly instead of re-fetching.
    await db.refresh(watchlist, attribute_names=["symbols"])
    return watchlist


@router.delete("/{watchlist_id}/symbols/{symbol_id}", response_model=WatchlistOut)
async def remove_symbol(
    watchlist_id: uuid.UUID, symbol_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> Watchlist:
    watchlist = await _get_owned_watchlist(db, user, watchlist_id)
    symbol = next((s for s in watchlist.symbols if s.id == symbol_id), None)
    if symbol is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symbol not found in watchlist")

    await db.delete(symbol)
    await db.commit()
    await db.refresh(watchlist, attribute_names=["symbols"])
    return watchlist


@router.put("/{watchlist_id}/symbols/reorder", response_model=WatchlistOut)
async def reorder_symbols(
    watchlist_id: uuid.UUID, payload: list[WatchlistSymbolReorder], db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> Watchlist:
    watchlist = await _get_owned_watchlist(db, user, watchlist_id)
    by_id = {s.id: s for s in watchlist.symbols}

    for entry in payload:
        symbol = by_id.get(entry.symbol_id)
        if symbol is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Symbol {entry.symbol_id} not found in watchlist")
        symbol.position = entry.position

    await db.commit()
    # Positions were mutated in place on the already-loaded `symbol` objects, so the
    # in-memory collection is already current — no re-fetch needed.
    return watchlist
