import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCounselorQueueStore } from '@/entities/consult';
import { DEFAULT_FACILITY_TINT, FACILITY_TINTS, FLOOR_FACILITY_PINS } from '@/entities/poi';
import type { FloorId } from '@/shared/types';
import { useScreenDraw } from '@/features/shared-screen-draw';
import { COUNSELOR_ROUTES } from '@/shared/config';
import {
  Badge,
  Button,
  FacilityPin,
  FloorRail,
  HeadingMarker,
  Icon,
  MapPreview,
  MapToggle,
  PillButton,
} from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './SessionPage.module.css';

const FLOORS: readonly { value: FloorId; label: string }[] = [
  { value: '1F', label: '1F · 출구' },
  { value: 'B1', label: 'B1 · 대합실' },
  { value: 'B2', label: 'B2 · 승강장' },
];

/** Screen 30 (FR-C-004 / FR-W-002) — the counselor's live consultation view. */
export function SessionPage() {
  const navigate = useNavigate();
  const selected = useCounselorQueueStore((state) => state.selected);
  const complete = useCounselorQueueStore((state) => state.complete);
  const [floor, setFloor] = useState<FloorId>('B1');
  const [facility, setFacility] = useState<string | null>(null);
  const [synced, setSynced] = useState(true);
  const [arrowSent] = useState(false);
  /**
   * Which pin the counselor is repositioning.
   *
   * TODO: Arming a mode is all the UI can do until the indoor-map editor lands;
   * dropping the new pin needs the map coordinate contract.
   */
  const [repinning, setRepinning] = useState<'dest' | 'origin' | null>(null);
  const { canvasRef, enabled: drawing, toggle: toggleDraw, clear: clearDraw } = useScreenDraw();

  const pins = FLOOR_FACILITY_PINS[floor];

  /** Marks the request done so the queue shows it as completed, then leaves. */
  const endCall = () => {
    complete(selected);
    void navigate(COUNSELOR_ROUTES.REQUESTS);
  };

  return (
    <CounselorConsoleShell connected>
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.summary}>
            <div className={styles.summaryBody}>
              <div className={styles.summaryHead}>
                <span className={styles.summaryMark}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0F5A3E"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
                    <circle cx="12" cy="10" r="2.4" />
                  </svg>
                </span>
                <div>
                  <div className={styles.summaryLabel}>사용자 정보</div>
                  <div className={styles.summaryRoute}>
                    역삼역 2번 개찰구 <span className={styles.summaryArrow}>→</span> 3번 출구
                  </div>
                </div>
              </div>
              <div className={styles.tags}>
                <Badge tone="neutral" className={styles.tag}>
                  <Icon name="globe" size={12} />
                  한국어
                </Badge>
                <Badge className={styles.tag}>
                  <Icon name="luggage" size={12} />
                  계단 없는 경로
                </Badge>
                <Badge className={styles.tag}>
                  <Icon name="elevator" size={12} />
                  선택한 엘리베이터로만 이동
                </Badge>
              </div>
            </div>
            <Button size="sm" className={styles.endCall} onClick={endCall}>
              상담 종료
            </Button>
          </div>

          <div className={styles.syncBar}>
            {synced ? (
              <>
                <span className={`${styles.syncChip} ${styles.syncOn}`}>
                  <span className={styles.syncDotOn} aria-hidden />
                  <span className={styles.syncLabelOn}>사용자 화면과 동기화 중</span>
                </span>
                <span className={styles.syncHint}>
                  사용자가 보는 지도·층·경로가 그대로 표시돼요
                </span>
              </>
            ) : (
              <>
                <span className={`${styles.syncChip} ${styles.syncOff}`}>
                  <span className={styles.syncDotOff} aria-hidden />
                  <span className={styles.syncLabelOff}>동기화 해제 · 자유 탐색</span>
                </span>
                <span className={styles.syncHint}>지금 보는 화면은 사용자에게 보이지 않아요</span>
              </>
            )}
            <div className={styles.syncModes}>
              <MapToggle
                on={synced}
                onClick={() => {
                  setSynced(true);
                  setFloor('B1');
                }}
              >
                사용자 시점 따라가기
              </MapToggle>
              <MapToggle on={!synced} onClick={() => setSynced(false)}>
                자유 탐색
              </MapToggle>
            </div>
          </div>

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendMe}`} />
              파란점: 사용자 현 위치
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendDest}`} />
              빨간점: 목적지
            </span>
          </div>

          <div className={styles.mapRow}>
            <FloorRail
              options={FLOORS}
              value={floor}
              onChange={(value) => {
                setFloor(value as FloorId);
                setFacility(null);
              }}
            />
            <MapPreview
              className={styles.map}
              me={{ left: '40%', top: '78%' }}
              dest={{ left: '62%', top: '26%' }}
            >
              <svg
                viewBox="0 0 340 250"
                preserveAspectRatio="xMidYMid slice"
                className={styles.mapSvg}
                aria-hidden
              >
                <rect x="0" y="0" width="340" height="250" fill="#eef1f5" />
                <rect
                  x="18"
                  y="16"
                  width="304"
                  height="218"
                  rx="10"
                  fill="#f8fafc"
                  stroke="#cdd5df"
                  strokeWidth="2"
                />
                {floor === '1F' && (
                  <>
                    <path d="M76 200 H264 V150 H76 Z" fill="#e9eef5" />
                    <rect
                      x="150"
                      y="30"
                      width="120"
                      height="26"
                      rx="5"
                      fill="#eef6f0"
                      stroke="#c4dfca"
                      strokeWidth="1.5"
                    />
                    <text
                      x="210"
                      y="47"
                      textAnchor="middle"
                      fontFamily="Pretendard"
                      fontSize="10"
                      fontWeight="700"
                      fill="#8fae97"
                    >
                      지상 광장
                    </text>
                  </>
                )}
                {floor === 'B1' && (
                  <>
                    <path
                      d="M120 200 V96 H236 V60"
                      fill="none"
                      stroke="#e3e9f1"
                      strokeWidth="28"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    <rect
                      x="34"
                      y="30"
                      width="58"
                      height="44"
                      rx="4"
                      fill="#fef8ec"
                      stroke="#e6d7ac"
                      strokeWidth="1.5"
                    />
                    <rect x="150" y="150" width="9" height="9" rx="2" fill="#B08640" />
                  </>
                )}
                {floor === 'B2' && (
                  <>
                    <rect
                      x="40"
                      y="170"
                      width="260"
                      height="52"
                      rx="6"
                      fill="#e5ebf2"
                      stroke="#d3dbe4"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="40"
                      y1="186"
                      x2="300"
                      y2="186"
                      stroke="#c3ccd8"
                      strokeWidth="1.5"
                      strokeDasharray="6 6"
                    />
                    <text
                      x="170"
                      y="212"
                      textAnchor="middle"
                      fontFamily="Pretendard"
                      fontSize="10"
                      fontWeight="700"
                      fill="#9aa4b2"
                    >
                      2호선 승강장
                    </text>
                  </>
                )}
              </svg>

              <div className={styles.floorBadge}>{floor}</div>

              {synced && (
                <div className={styles.viewport}>
                  <span className={styles.viewportLabel}>사용자 화면 영역</span>
                </div>
              )}

              {arrowSent && <div className={styles.sentArrow}>➤</div>}

              {pins.map((pin) => (
                <FacilityPin
                  key={pin.key}
                  x={pin.x}
                  y={pin.y}
                  tint={FACILITY_TINTS[pin.icon] ?? DEFAULT_FACILITY_TINT}
                  label={pin.label}
                  icon={<Icon name={pin.icon} size={14} />}
                  blink={facility === pin.key}
                />
              ))}

              <div className={styles.facilityToggles}>
                {pins.map((pin) => (
                  <MapToggle
                    key={pin.key}
                    on={facility === pin.key}
                    onClick={() => setFacility(facility === pin.key ? null : pin.key)}
                  >
                    <Icon name={pin.icon} size={13} />
                    {pin.label}
                  </MapToggle>
                ))}
              </div>
            </MapPreview>
          </div>

          <div className={styles.mapActions}>
            <PillButton
              className={styles.mapAction}
              on={repinning === 'dest'}
              onClick={() => setRepinning(repinning === 'dest' ? null : 'dest')}
            >
              <Icon name="target" size={14} />
              목적지 재지정
            </PillButton>
            <PillButton
              className={styles.mapAction}
              on={repinning === 'origin'}
              onClick={() => setRepinning(repinning === 'origin' ? null : 'origin')}
            >
              <Icon name="pin" size={14} />
              현재 위치 수정
            </PillButton>
          </div>

          <div className={styles.notes}>
            <div className={styles.notesLabel}>
              <Icon name="note" size={13} />
              상담 메모 · 실시간 STT
            </div>
            <div className={styles.notesBody}>
              <div>
                <span className={styles.speakerUser}>사용자</span>
                <br />
                <span className={styles.line}>지금 여기가 어딘지 모르겠어요.</span>
              </div>
              <div>
                <span className={styles.speakerAgent}>상담원</span>
                <br />
                <span className={styles.line}>
                  12번 기둥 기준으로 왼쪽 엘리베이터로 안내드릴게요.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.rail}>
          <div className={styles.railHead}>
            <span className={styles.liveChip}>
              <span className={styles.liveDotWrap}>
                <span className={styles.liveDot} />
                <span className={styles.liveRing} />
              </span>
              화면 공유 · 사용자 카메라
              <span className={styles.liveShine} />
            </span>
            <span className={styles.syncedChip}>
              <span className={styles.syncedDot} aria-hidden />
              <span className={styles.syncedLabel}>좌측 지도와 동일</span>
            </span>
          </div>

          <div className={styles.stream}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              style={{ pointerEvents: drawing ? 'auto' : 'none' }}
            />
            <div className={styles.drawTools}>
              {drawing && (
                <MapToggle className={styles.drawTool} onClick={clearDraw}>
                  <Icon name="eraser" size={13} />
                  지우기
                </MapToggle>
              )}
              <MapToggle className={styles.drawTool} on={drawing} onClick={toggleDraw}>
                <Icon name="pencil" size={13} />
                그리기
              </MapToggle>
            </div>

            <div className={styles.cam}>
              <div className={styles.camPill}>
                <b>To 3번 출구</b> · 4분
              </div>
              <div className={styles.camArrow}>↑</div>
              {arrowSent && <div className={styles.camSentArrow}>↗</div>}
              <div className={styles.camCaption}>에스컬레이터에서 좌회전</div>
            </div>

            <div className={styles.miniMapWrap}>
              <MapPreview className={styles.miniMap} dest={{ left: '68%', top: '26%' }}>
                <svg
                  viewBox="0 0 260 200"
                  preserveAspectRatio="xMidYMid slice"
                  className={styles.mapSvg}
                  aria-hidden
                >
                  <rect x="0" y="0" width="260" height="200" fill="#eef1f5" />
                  <rect
                    x="14"
                    y="12"
                    width="232"
                    height="176"
                    rx="8"
                    fill="#f8fafc"
                    stroke="#cdd5df"
                    strokeWidth="2"
                  />
                  <path
                    d="M96 158 V88 H176 V48"
                    fill="none"
                    stroke="#e3e9f1"
                    strokeWidth="22"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <rect x="150" y="118" width="7" height="7" rx="2" fill="#B08640" />
                  <polyline
                    points="96,158 96,88 176,88 176,52"
                    fill="none"
                    stroke="#3EB489"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="1 11"
                  />
                </svg>
                <HeadingMarker style={{ left: '37%', top: '79%' }} />
              </MapPreview>
            </div>
          </div>
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
