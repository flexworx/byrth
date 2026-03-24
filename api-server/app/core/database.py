"""Database engine and session management — PostgreSQL via asyncpg."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select, text

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables and seed default admin user if no users exist."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        if "already exists" in str(e):
            logger.info("Tables/types already exist, skipping create_all")
        else:
            raise

    # Seed default admin user
    from app.models.models import User, MurphAgent
    from app.core.security import hash_password

    async with async_session() as session:
        result = await session.execute(select(User).limit(1))
        existing_user = result.scalar_one_or_none()

        if existing_user is None:
            admin = User(
                username="Brendan Murphy",
                email="admin@flexworx.io",
                hashed_password=hash_password("nexgen2026"),
                role="platform_admin",
                mfa_enabled=False,
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            logger.info("Seeded default admin user: admin@flexworx.io")
        else:
            logger.info("Users table already populated, skipping seed")

    # Seed default agents (7 specialized types)
    async with async_session() as session:
        result = await session.execute(select(MurphAgent).limit(1))
        existing_agent = result.scalar_one_or_none()

        if existing_agent is None:
            from datetime import datetime, timezone
            from app.services.agent_types import get_default_agents

            for agent_data in get_default_agents():
                agent = MurphAgent(
                    agent_id=agent_data["agent_id"],
                    name=agent_data["name"],
                    status=agent_data["status"],
                    agent_type=agent_data["agent_type"],
                    capabilities=agent_data["capabilities"],
                    description=agent_data["description"],
                    version=agent_data["version"],
                    last_heartbeat=datetime.now(timezone.utc),
                )
                session.add(agent)
            await session.commit()
            logger.info("Seeded 7 default specialized agents")
        else:
            logger.info("Agents table already populated, skipping seed")
