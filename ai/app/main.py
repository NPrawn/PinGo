import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.core.config import AppSettings
from app.core.readiness import ReadinessState
from app.maps.map_loader import MapLoadError, MapLoader

logger = logging.getLogger(__name__)


def create_app(
    readiness: ReadinessState | None = None,
    settings: AppSettings | None = None,
    map_loader: MapLoader | None = None,
) -> FastAPI:
    readiness_state = readiness or ReadinessState()
    app_settings = settings or AppSettings.from_env()
    loader = map_loader or MapLoader()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        application.state.map_context = None
        if app_settings.map_version is None or app_settings.map_model_path is None:
            readiness_state.mark_not_ready("map", "MAP_NOT_CONFIGURED")
        else:
            try:
                application.state.map_context = loader.load(
                    app_settings.map_version,
                    app_settings.map_model_path,
                )
            except MapLoadError:
                logger.exception(
                    "COLMAP 맵 로딩에 실패했습니다: mapVersion=%s",
                    app_settings.map_version,
                )
                readiness_state.mark_not_ready("map", "MAP_LOAD_FAILED")
            else:
                readiness_state.mark_ready("map")

        try:
            yield
        finally:
            application.state.map_context = None
            readiness_state.mark_not_ready("map")

    application = FastAPI(
        title="PinGo 6DoF Localization API",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )
    application.state.readiness = readiness_state
    application.state.map_context = None
    application.include_router(health_router)
    return application


app = create_app()
