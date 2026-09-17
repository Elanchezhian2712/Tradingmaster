from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps import get_current_user
from app.models.core import User
from app.models.trading import PaperBook, PaperTrade
from app.schemas.paper import PaperBookIn, PaperBookOut

router = APIRouter(prefix="/api/paper", tags=["paper-trading"])


async def _load_trades(db: AsyncSession, user_id) -> list[PaperTrade]:
    result = await db.execute(
        select(PaperTrade).where(PaperTrade.user_id == user_id).order_by(PaperTrade.exit_time.desc().nullslast())
    )
    return list(result.scalars().all())


@router.get("/book", response_model=PaperBookOut)
async def get_book(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> PaperBookOut:
    """
    The user's live book plus their closed trades. An account that has never
    traded gets an empty book rather than a 404 — there is nothing missing,
    it just has not started yet.
    """
    book = await db.get(PaperBook, user.id)
    trades = await _load_trades(db, user.id)
    return PaperBookOut(
        snapshot=book.snapshot if book else {},
        trades=list(trades),
        updated_at=book.updated_at if book else None,
    )


@router.put("/book", response_model=PaperBookOut)
async def put_book(
    payload: PaperBookIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaperBookOut:
    """
    Replace the live snapshot and append any trades not already stored.

    The snapshot is replaced wholesale because the client engine is the single
    writer — it owns the book and this endpoint is where it parks it. Trades
    are append-only and de-duplicated on the client's trade id, so a retry
    after a dropped response cannot double-count a trade.
    """
    book = await db.get(PaperBook, user.id)
    if book is None:
        book = PaperBook(user_id=user.id, snapshot=payload.snapshot)
        db.add(book)
    else:
        book.snapshot = payload.snapshot

    if payload.trades:
        existing = await db.execute(
            select(PaperTrade.client_trade_id).where(
                PaperTrade.user_id == user.id,
                PaperTrade.client_trade_id.in_([t.client_trade_id for t in payload.trades]),
            )
        )
        already_stored = set(existing.scalars().all())
        for trade in payload.trades:
            if trade.client_trade_id in already_stored:
                continue
            db.add(
                PaperTrade(
                    user_id=user.id,
                    status="closed" if trade.exit_time is not None else "open",
                    **trade.model_dump(),
                )
            )

    await db.commit()
    await db.refresh(book)
    return PaperBookOut(snapshot=book.snapshot, trades=await _load_trades(db, user.id), updated_at=book.updated_at)


@router.delete("/book", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Reset the account: drop the live book and every stored trade."""
    await db.execute(delete(PaperTrade).where(PaperTrade.user_id == user.id))
    await db.execute(delete(PaperBook).where(PaperBook.user_id == user.id))
    await db.commit()
