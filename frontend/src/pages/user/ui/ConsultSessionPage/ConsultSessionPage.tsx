import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { useConsultSignaling } from '@/features/consult-signaling';
import { getConsultation } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { HeadingMarker, Icon, MapPreview } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultSessionPage.module.css';

/** Screen 20 (FR-U-015 / FR-W-002) — live consultation from the user's side. */
export function ConsultSessionPage() {
  const consultationId = useConsultStore((state) => state.consultationId);
  const signalingRoomId = useConsultStore((state) => state.signalingRoomId);
  const signalingAccessToken = useConsultStore((state) => state.signalingAccessToken);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const { localVideoRef, remoteVideoRef, status, error, remoteCaption, captionsSupported } =
    useConsultSignaling(signalingRoomId, 'USER', signalingAccessToken);
  const station = useStationStore((state) => state.station);
  const destination = useNavigationStore((state) => state.destination) ?? '강남파이낸스센터';
  const waypoints = useNavigationStore((state) => state.waypoints);
  const removeWaypoint = useNavigationStore((state) => state.removeWaypoint);

  /**
   * 새로고침하면 signaling 토큰이 남지 않는다(짧은 만료 시간). 방은 알고 있으므로
   * 상세 조회로 토큰만 다시 받아 WebSocket 접속이 401로 거절되지 않게 한다.
   */
  useEffect(() => {
    if (!consultationId || !userSessionId || !signalingRoomId || signalingAccessToken) return;

    void getConsultation(consultationId, userSessionId)
      .then((consultation) => {
        if (!consultation.signalingRoomId || !consultation.signalingAccessToken) {
          setTokenError('상담 연결 정보를 받지 못했습니다.');
          return;
        }
        setSignalingRoom(consultation.signalingRoomId, consultation.signalingAccessToken);
      })
      .catch(() => setTokenError('상담 연결 정보를 받지 못했습니다.'));
  }, [consultationId, setSignalingRoom, signalingAccessToken, signalingRoomId, userSessionId]);

  return (
    <PhoneFrame dark layout="flush">
      <>
        <div className={styles.bar}>
          <span className={styles.liveChip}>
            <span className={styles.liveDotWrap}>
              <span className={styles.liveDot} />
              <span className={styles.liveRing} />
            </span>
            상담 연결됨 · 화면 공유 중
            <span className={styles.liveShine} />
          </span>
          <Link to={USER_ROUTES.CONSULT_ENDED} className={styles.endCall}>
            상담 종료
          </Link>
        </div>

        <div className={styles.cam}>
          <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteVideo} />
          <video ref={localVideoRef} autoPlay muted playsInline className={styles.localVideo} />
          <span
            className={styles.connectionStatus}
            role={error ?? tokenError ? 'alert' : undefined}
          >
            {error ?? tokenError ?? `연결 상태: ${status}`}
          </span>
          <div
            className={[styles.routeHeader, waypoints.length > 0 && styles.routeHeaderCompact]
              .filter(Boolean)
              .join(' ')}
            aria-label="상담 중인 경로"
          >
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={styles.pointDot} aria-hidden />
                <small>출발지</small>
              </span>
              <strong>{station} B1</strong>
            </div>
            {waypoints.map((waypoint, index) => (
              <Fragment key={waypoint}>
                <span className={styles.routeArrow} aria-hidden>
                  <Icon name="arrow-right" size={16} />
                </span>
                <div className={`${styles.routePoint} ${styles.waypointPoint}`}>
                  <button
                    type="button"
                    className={styles.removeWaypoint}
                    onClick={() => removeWaypoint(waypoint)}
                    aria-label={`${waypoint} 경유지 삭제`}
                    title={`${waypoint} 경유지 삭제`}
                  >
                    ×
                  </button>
                  <span className={styles.routeLabel}>
                    <span className={`${styles.pointDot} ${styles.pointDotWaypoint}`} aria-hidden />
                    <small>경유 {index + 1}</small>
                  </span>
                  <strong title={waypoint}>{waypoint}</strong>
                </div>
              </Fragment>
            ))}
            <span className={styles.routeArrow} aria-hidden>
              <Icon name="arrow-right" size={16} />
            </span>
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={`${styles.pointDot} ${styles.pointDotDestination}`} aria-hidden />
                <small>목적지</small>
              </span>
              <strong title={destination}>{destination}</strong>
            </div>
          </div>
          <div className={styles.translation}>
            <div className={styles.translationLabel}>
              <Icon name="globe" size={13} />
              실시간 자막 · 상담원
            </div>
            <div className={styles.translationPrimary}>
              {remoteCaption ||
                (captionsSupported
                  ? '상담원의 음성을 인식하고 있습니다.'
                  : '이 브라우저에서는 음성 자막을 지원하지 않습니다.')}
            </div>
          </div>
        </div>

        <div className={styles.lower}>
          <MapPreview className={styles.map} dest={{ left: '68%', top: '26%' }}>
            <svg
              viewBox="0 0 300 240"
              preserveAspectRatio="xMidYMid slice"
              className={styles.mapSvg}
              aria-hidden
            >
              <rect x="0" y="0" width="300" height="240" fill="#eef1f5" />
              <rect
                x="22"
                y="20"
                width="256"
                height="200"
                rx="9"
                fill="#f8fafc"
                stroke="#cdd5df"
                strokeWidth="2"
              />
              <path
                d="M132 168 V96 H204 V64"
                fill="none"
                stroke="#e3e9f1"
                strokeWidth="24"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <rect
                x="36"
                y="34"
                width="48"
                height="40"
                rx="4"
                fill="#eef6f0"
                stroke="#c4dfca"
                strokeWidth="1.5"
              />
              <rect
                x="214"
                y="166"
                width="46"
                height="38"
                rx="4"
                fill="#f7eef2"
                stroke="#e2c7d3"
                strokeWidth="1.5"
              />
              <rect x="158" y="126" width="8" height="8" rx="2" fill="#B08640" />
              <polyline
                points="132,168 132,96 204,96 204,68"
                fill="none"
                stroke="#3EB489"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1 11"
              />
            </svg>

            <div className={styles.destLabel}>3번 출구</div>
            <HeadingMarker style={{ left: '44%', top: '58%' }} />
          </MapPreview>

          <div className={styles.syncNote}>
            <span className={styles.syncDot} aria-hidden />
            <p className={styles.syncText}>
              상담원이 <b>같은 지도</b>를 보며 안내 중이에요
            </p>
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
