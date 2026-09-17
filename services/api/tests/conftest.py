import asyncio

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import Base, async_session_factory, engine
from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    # The SQLAlchemy async engine is a module-level singleton whose connection
    # pool binds to whichever event loop first used it; pytest-asyncio's default
    # per-test loop would make every test after the first hit a closed loop, so
    # all tests share this one session-scoped loop instead.
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def _reset_schema():
    """Recreate a clean schema before every test so tests never depend on execution order."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
