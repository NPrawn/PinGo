import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import type { FloorId } from '@/shared/types';
import { USER_ROUTES } from '@/shared/config';
import { BackLink, ButtonLink, Icon, MapPreview, PillButton, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './LocateManualPage.module.css';

const FLOORS: readonly { value: FloorId; label: string }[] = [
  { value: 'B2', label: 'B2 · 승강장' },
  { value: 'B1', label: 'B1 · 대합실' },
  { value: '1F', label: '1F · 출구' },
];

/** TODO: Replace with facility positions from the indoor-map API. */
const MARKERS = [
  { key: 'exit3', left: '18%', top: '20%', label: '3번 출구', exit: '3' },
  { key: 'elev', left: '78%', top: '20%', label: '엘리베이터', icon: 'elevator' },
  { key: 'wc', left: '78%', top: '60%', label: '화장실', icon: 'restroom' },
  { key: 'info', left: '20%', top: '60%', label: '안내센터', icon: 'info' },
  { key: 'pillar', left: '50%', top: '55%', label: '12번 기둥', pillar: '12' },
  { key: 'gate2', left: '31%', top: '27%', label: '2번 개찰구', icon: 'door' },
] as const;

/**
 * Screen 09 (FR-U-006) — manual position selection on the floor plan.
 *
 * TODO: The map is a static schematic. Make it tappable once the indoor-map
 * renderer and coordinate contract are in place.
 */
export function LocateManualPage() {
  const floor = useStationStore((state) => state.floor);
  const setFloor = useStationStore((state) => state.setFloor);

  return (
    <PhoneFrame>
      <div className={styles.headerBar}>
        <BackLink to={USER_ROUTES.LOCATE_FAILED}>뒤로</BackLink>
        <ConsultCta variant="icon" />
      </div>
      <Title>
        지도에서 현재
        <br />
        위치를 찍어주세요
      </Title>
      <Sub>먼저 층을 선택한 뒤 지도를 탭하세요.</Sub>

      <div className={styles.floors}>
        {FLOORS.map((option) => (
          <PillButton
            key={option.value}
            on={floor === option.value}
            onClick={() => setFloor(option.value)}
          >
            {option.label}
          </PillButton>
        ))}
      </div>

      <MapPreview className={styles.map} me={{ left: '46%', top: '46%' }}>
        <svg
          viewBox="0 0 300 360"
          preserveAspectRatio="xMidYMid slice"
          className={styles.mapSvg}
          aria-hidden
        >
          <rect x="0" y="0" width="300" height="360" fill="#eef1f5" />
          <rect
            x="26"
            y="30"
            width="248"
            height="300"
            rx="10"
            fill="#f8fafc"
            stroke="#cdd5df"
            strokeWidth="2"
          />
          <path d="M60 66 H240 V120 H150 V300 H108 V120 H60 Z" fill="#e9eef5" />
          <path d="M108 120 H240 V172 H108 Z" fill="#e9eef5" />
          <rect
            x="42"
            y="250"
            width="216"
            height="66"
            rx="6"
            fill="#e5ebf2"
            stroke="#d3dbe4"
            strokeWidth="1.5"
          />
          <line
            x1="42"
            y1="266"
            x2="258"
            y2="266"
            stroke="#c3ccd8"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
          <text
            x="150"
            y="308"
            textAnchor="middle"
            fontFamily="Pretendard"
            fontSize="10"
            fontWeight="700"
            fill="#9aa4b2"
          >
            2호선 승강장
          </text>
          <rect
            x="42"
            y="46"
            width="52"
            height="48"
            rx="4"
            fill="#fef8ec"
            stroke="#e6d7ac"
            strokeWidth="1.5"
          />
          <rect
            x="206"
            y="46"
            width="52"
            height="48"
            rx="4"
            fill="#eef6f0"
            stroke="#c4dfca"
            strokeWidth="1.5"
          />
          <rect
            x="206"
            y="188"
            width="52"
            height="46"
            rx="4"
            fill="#f7eef2"
            stroke="#e2c7d3"
            strokeWidth="1.5"
          />
          <rect
            x="42"
            y="188"
            width="52"
            height="46"
            rx="4"
            fill="#eef2fb"
            stroke="#c7d2ec"
            strokeWidth="1.5"
          />
          <rect x="146" y="196" width="9" height="9" rx="2" fill="#B08640" />
          <rect x="120" y="140" width="7" height="7" rx="1.5" fill="#cbd3de" />
          <rect x="176" y="140" width="7" height="7" rx="1.5" fill="#cbd3de" />
        </svg>

        <div className={styles.floorBadge}>{floor}</div>

        {MARKERS.map((marker) => (
          <div
            key={marker.key}
            className={styles.marker}
            style={{
              left: marker.left,
              top: marker.top,
              transform: marker.key === 'pillar' ? 'translateX(-50%)' : undefined,
            }}
          >
            {'exit' in marker && <span className={styles.markerExit}>{marker.exit}</span>}
            {'pillar' in marker && <span className={styles.markerPillar}>{marker.pillar}</span>}
            {'icon' in marker && (
              <span className={styles.markerIcon}>
                <Icon name={marker.icon} size={16} />
              </span>
            )}
            <span className={styles.markerLabel}>{marker.label}</span>
          </div>
        ))}

        <div className={styles.meLabel}>현재 위치</div>
      </MapPreview>

      <p className={styles.hint}>지도에 표시된 랜드마크를 참고해 현재 위치를 탭하세요</p>
      <div className={styles.actions}>
        <ButtonLink to={USER_ROUTES.LOCATE_SUCCESS} className={styles.confirm}>
          이 위치로 확정
        </ButtonLink>
      </div>
    </PhoneFrame>
  );
}
