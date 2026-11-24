"""FastAPI application entry point."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from strawberry.fastapi import GraphQLRouter

from app.api import admin, evaluations, exams, health, lessons, me, placement, practice, tracks, tutor, units
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import RequestLogMiddleware, configure_logging
from app.core.ratelimit import RateLimiter, RateLimitMiddleware
from app.db.session import dispose_engine
from app.graphql.context import get_context
from app.graphql.schema import build_schema
from app.services.evaluate import worker_loop


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Cache-Control", "no-store")
        return response


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    stop = asyncio.Event()
    worker = None
    if get_settings().evaluation_worker and get_settings().environment != "test":
        worker = asyncio.create_task(worker_loop(stop))
    yield
    stop.set()
    if worker is not None:
        await worker
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(
        title="TutorBot English AI API",
        version="0.1.0",
        description="REST actions for TutorBot English AI. Reads use GraphQL at /graphql.",
        docs_url="/docs" if settings.is_dev else None,
        redoc_url=None,
        lifespan=lifespan,
    )
    register_error_handlers(app)
    app.add_middleware(RateLimitMiddleware, limiter=RateLimiter(settings.rate_limit_per_minute))
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["authorization", "content-type", "x-request-id"],
    )
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(lessons.router)
    app.include_router(practice.router)
    app.include_router(placement.router)
    app.include_router(units.router)
    app.include_router(tracks.router)
    app.include_router(evaluations.router)
    app.include_router(exams.router)
    app.include_router(tutor.router)
    app.include_router(admin.router)
    app.include_router(admin.reports_router)
    graphql = GraphQLRouter(
        build_schema(), context_getter=get_context, graphql_ide="graphiql" if settings.is_dev else None
    )
    app.include_router(graphql, prefix="/graphql", include_in_schema=False)
    return app


app = create_app()
