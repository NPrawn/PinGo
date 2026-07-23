from fastapi import FastAPI

from app.api.health import router as health_router
from app.core.readiness import ReadinessState


def create_app(readiness: ReadinessState | None = None) -> FastAPI:
    """테스트와 실행 환경에서 공통으로 사용할 FastAPI 애플리케이션을 생성한다."""
    application = FastAPI(
        title="PinGo 6DoF Localization API",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
    )
    application.state.readiness = readiness or ReadinessState()
    application.include_router(health_router)
    return application


app = create_app()
