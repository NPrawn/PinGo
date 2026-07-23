from fastapi import APIRouter, Request, Response, status

from app.core.readiness import ReadinessState
from app.schemas.health import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", response_model=HealthResponse)
def liveness() -> HealthResponse:
    """HTTP 프로세스가 실행 중인지 반환한다."""
    return HealthResponse(status="LIVE")


@router.get("/ready", response_model=HealthResponse)
def readiness(request: Request, response: Response) -> HealthResponse:
    """엔진과 맵이 위치추정 요청을 처리할 준비가 되었는지 반환한다."""
    state: ReadinessState = request.app.state.readiness
    snapshot = state.snapshot()
    if not snapshot.ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="READY" if snapshot.ready else "NOT_READY",
        components=snapshot.components,
    )
