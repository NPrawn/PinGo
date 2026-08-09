import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.localization import LocalizerFactory, router as localization_router
from app.core.config import AppSettings
from app.core.inference_limiter import InferenceLimiter
from app.core.readiness import ReadinessState
from app.engine.localizer import MultiMapLocalizer
from app.maps.map_context import MapContext
from app.maps.map_loader import MapLoadError, MapLoader

logger = logging.getLogger(__name__)


def create_app(
    readiness: ReadinessState | None = None,
    settings: AppSettings | None = None,
    map_loader: MapLoader | None = None,
    localizer_factory: LocalizerFactory | None = None,
    inference_limiter: InferenceLimiter | None = None,
) -> FastAPI:
    readiness_state = readiness or ReadinessState()
    app_settings = settings or AppSettings.from_env()
    loader = map_loader or MapLoader()
    factory = localizer_factory or (
        lambda contexts: MultiMapLocalizer(
            dict(contexts),
            device=app_settings.device,
            input_size=app_settings.input_size,
        )
    )
    limiter = inference_limiter or InferenceLimiter(
        max_concurrent=app_settings.max_concurrent_inferences,
        max_queue_size=app_settings.max_queue_size,
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        application.state.map_context = None
        application.state.map_contexts = {}
        application.state.localizer = None
        application.state.engine_preload_failed = False
        map_specs = app_settings.configured_maps()
        if not map_specs:
            readiness_state.mark_not_ready("map", "MAP_NOT_CONFIGURED")
        else:
            try:
                contexts: dict[str, MapContext] = {
                    spec.map_version: loader.load(spec.map_version, spec.path)
                    for spec in map_specs
                }
            except MapLoadError:
                logger.exception(
                    "COLMAP 맵 세트 로딩에 실패했습니다: mapVersions=%s",
                    [spec.map_version for spec in map_specs],
                )
                readiness_state.mark_not_ready("map", "MAP_LOAD_FAILED")
            else:
                application.state.map_contexts = contexts
                application.state.map_context = (
                    next(iter(contexts.values())) if len(contexts) == 1 else None
                )
                readiness_state.mark_ready("map")
                try:
                    localizer = factory(contexts)
                    load = getattr(localizer, "load", None)
                    if callable(load):
                        load()
                except Exception:
                    logger.exception(
                        "다중 맵 위치추정 엔진 사전 로딩에 실패했습니다: "
                        "mapVersions=%s device=%s",
                        list(contexts),
                        app_settings.device,
                    )
                    application.state.engine_preload_failed = True
                    readiness_state.mark_not_ready("engine", "ENGINE_LOAD_FAILED")
                else:
                    application.state.localizer = localizer
                    readiness_state.mark_ready("engine")

        try:
            yield
        finally:
            application.state.localizer = None
            application.state.map_context = None
            application.state.map_contexts = {}
            readiness_state.mark_not_ready("engine")
            readiness_state.mark_not_ready("map")

    application = FastAPI(
        title="PinGo 6DoF Localization API",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )
    application.state.readiness = readiness_state
    application.state.settings = app_settings
    application.state.map_context = None
    application.state.map_contexts = {}
    application.state.localizer = None
    application.state.engine_preload_failed = False
    application.state.localizer_factory = factory
    application.state.inference_limiter = limiter
    application.include_router(health_router)
    application.include_router(localization_router)
    return application


app = create_app()
