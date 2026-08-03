import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { resolveDestination, useDestinationSearch } from '@/entities/poi';
import type { Poi } from '@/entities/poi';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { findNearestExit, getFacility, getRecommendedExits, updateUserSession } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { Field, Icon3d, Kicker, SelectRow } from '@/shared/ui';
import type { Icon3dTone } from '@/shared/ui';
import styles from './DestinationSearch.module.css';

const RESULT_TONES: readonly Icon3dTone[] = ['mint', 'sky', 'coral', 'lilac', 'gold'];

const QUICK_DESTINATIONS: readonly Poi[] = [
  { name: '올리브영 역삼중앙점', icon: 'cosmetics', meta: '빠른 목적지', kind: 'place' },
  { name: '차지 역삼점', icon: 'store', meta: '빠른 목적지', kind: 'place' },
  { name: '스타벅스 아크플레이스점', icon: 'coffee', meta: '빠른 목적지', kind: 'place' },
  { name: '블리스 라운드 역삼점', icon: 'store', meta: '빠른 목적지', kind: 'place' },
];

const QUICK_DESTINATION_LABELS: Readonly<Record<string, readonly string[]>> = {
  '올리브영 역삼중앙점': ['올리브영', '역삼중앙점'],
  '스타벅스 아크플레이스점': ['스타벅스', '아크플레이스점'],
  '블리스 라운드 역삼점': ['블리스 라운드', '역삼점'],
};

type DestinationSearchProps = {
  nextRoute?: string;
  compact?: boolean;
  deferNavigation?: boolean;
  onSelect?: (destination: string) => void;
};

/**
 * Destination search with quick-access tiles.
 *
 * 검색 결과는 선택된 역을 기준으로 목적지 검색 API에서 가져온다.
 */
export function DestinationSearch({
  nextRoute = USER_ROUTES.ROUTE_OPTIONS,
  compact = false,
  deferNavigation = false,
  onSelect,
}: DestinationSearchProps) {
  const navigate = useNavigate();
  const startNewJourney = useNavigationStore((state) => state.startNewJourney);
  const stationId = useStationStore((state) => state.stationId);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  /**
   * 지금 처리 중인 목적지 이름. 없으면 대기 상태다.
   *
   * 목적지 하나를 고르면 출구 추천·시설 조회를 거쳐 도착 노드를 구한 뒤 전역 스토어를
   * 덮어쓴다. 그 사이에 다른 항목을 누르면 두 흐름이 겹쳐 스토어에 서로 다른 목적지의 값이
   * 뒤섞인다 — 이름은 나중에 누른 것인데 도착 노드는 먼저 누른 것이 남는 식이다.
   *
   * `useRef`가 아니라 상태로 두는 이유는 화면이 그 사실을 보여줘야 하기 때문이다. 눌러도
   * 아무 일도 일어나지 않는 것처럼 보이면 사용자가 다시 누른다.
   */
  const [choosing, setChoosing] = useState<string | null>(null);

  const destinationSearch = useDestinationSearch(stationId, query, searched);
  const results = destinationSearch.data ?? [];

  const choose = async (poi: Poi) => {
    // 처리 중에는 새 선택을 받지 않는다. 화면도 함께 막지만 이중으로 지킨다.
    if (choosing !== null) return;
    setChoosing(poi.name);

    /**
     * 안내를 시작할 도착 노드.
     *
     * 경로 옵션 화면이 유형별로 다시 정하지만(최단·엘리베이터 우선의 출구가 다르다) 그 전에
     * 목적지가 실내 경로에 닿는지 알아야 하므로 여기서 한 번 구해 둔다.
     */
    let selectedPoi = poi;
    let targetNodeId: number | undefined;

    try {
      if (
        selectedPoi.id == null &&
        selectedPoi.latitude == null &&
        selectedPoi.longitude == null &&
        stationId != null
      ) {
        selectedPoi = (await resolveDestination(stationId, selectedPoi.name)) ?? selectedPoi;
      }

      if (selectedPoi.id != null && selectedPoi.kind === 'facility') {
        const facility = await getFacility(selectedPoi.id);
        targetNodeId = facility.linkedNodeId;
      }

      if (selectedPoi.id != null && selectedPoi.kind === 'place') {
        const exits = await getRecommendedExits(selectedPoi.id);
        const primaryExit = exits.find((exit) => exit.isPrimary) ?? exits[0];
        if (primaryExit?.exitFacilityId != null) {
          const facility = await getFacility(primaryExit.exitFacilityId);
          targetNodeId = facility.linkedNodeId;
        }
      }

      /**
       * 카카오 검색으로만 찾은 장소.
       *
       * 등록된 장소가 아니라 `destinationId`가 없어 출구 추천을 물을 수 없다. 대신 좌표는
       * 있으므로 그 좌표에서 가장 가까운 출구를 서버에 묻고, 그 출구의 연결 노드를 도착점으로
       * 삼는다. 실내 경로는 출입구에서 끝나므로 외부 목적지의 도착점은 어차피 출구다.
       *
       * 이것이 없으면 targetNodeId가 비어 경로 옵션 화면이 아무것도 못 그린다.
       */
      if (
        selectedPoi.id == null &&
        selectedPoi.latitude != null &&
        selectedPoi.longitude != null &&
        stationId != null
      ) {
        const nearestExit = await findNearestExit({
          stationId,
          destinationLatitude: selectedPoi.latitude,
          destinationLongitude: selectedPoi.longitude,
        });
        if (nearestExit.exitFacilityId != null) {
          const facility = await getFacility(nearestExit.exitFacilityId);
          targetNodeId = facility.linkedNodeId;
        }
      }
    } catch {
      targetNodeId = undefined;
    }

    startNewJourney(selectedPoi.name, {
      destinationId: selectedPoi.id,
      destinationType: selectedPoi.destinationType ?? selectedPoi.kind,
      targetNodeId,
      destinationLatitude: selectedPoi.latitude,
      destinationLongitude: selectedPoi.longitude,
      destinationAddress: selectedPoi.address,
    });
    if (userSessionId && selectedPoi.id != null) {
      void updateUserSession(userSessionId, {
        selectedStationId: stationId ?? undefined,
        destinationId: selectedPoi.id,
        destinationType: selectedPoi.destinationType?.toLowerCase() ?? selectedPoi.kind,
      }).catch(() => undefined);
    }
    onSelect?.(selectedPoi.name);
    if (deferNavigation) {
      // 화면을 떠나지 않으므로 다음 선택을 받을 수 있게 되돌린다.
      setChoosing(null);
      return;
    }
    // 화면이 바뀌면 이 컴포넌트가 사라진다. 여기서 상태를 되돌리면 언마운트 후 갱신이 된다.
    void navigate(nextRoute);
  };

  return (
    <div className={[styles.root, compact && styles.compact].filter(Boolean).join(' ')}>
      <div className={styles.searchWrap}>
        <Field
          big
          className={styles.searchField}
          placeholder="어디로 가세요? (역, 출구, 시설)"
          aria-label="목적지 검색"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearched(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setSearched(true);
          }}
        />
        <span className={styles.searchIcon}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.6-3.6" />
          </svg>
        </span>
        <button type="button" className={styles.searchSubmit} onClick={() => setSearched(true)}>
          검색
        </button>
      </div>

      {searched ? (
        <>
          <Kicker className={styles.resultsKicker}>검색 결과 · &quot;{query}&quot;</Kicker>
          <div className={styles.results}>
            {results.map((poi, index) => {
              const busy = choosing === poi.name;
              return (
                <SelectRow
                  key={poi.name}
                  className={styles.result}
                  indicator="none"
                  /* 한 곳을 처리하는 동안에는 목록 전체를 잠근다. */
                  disabled={choosing !== null}
                  onClick={() => void choose(poi)}
                >
                  <Icon3d
                    name={poi.icon}
                    tone={RESULT_TONES[index % RESULT_TONES.length]}
                    iconSize={17}
                    className={styles.resultIcon}
                  />
                  <span className={styles.resultBody}>
                    <b className={styles.resultName}>{poi.name}</b>
                    <br />
                    <span className={styles.resultMeta}>
                      {busy ? '경로를 준비하고 있어요…' : poi.meta}
                    </span>
                  </span>
                  {busy ? (
                    <span className={styles.chooseSpinner} aria-hidden />
                  ) : (
                    <span className={styles.chevron}>›</span>
                  )}
                </SelectRow>
              );
            })}
            {destinationSearch.isPending && <div className={styles.empty}>검색하고 있어요…</div>}
            {destinationSearch.isError && (
              <div className={styles.empty}>목적지를 불러오지 못했어요.</div>
            )}
            {!destinationSearch.isPending && !destinationSearch.isError && results.length === 0 && (
              <div className={styles.empty}>
                일치하는 목적지가 없어요. 다른 이름으로 검색해보세요.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className={styles.quickHead}>
            <Kicker className={styles.quickKicker}>빠른 목적지</Kicker>
          </div>
          <div className={styles.tiles}>
            {QUICK_DESTINATIONS.map((poi, index) => (
              <button
                key={poi.name}
                type="button"
                className={styles.tile}
                aria-label={poi.name}
                /* 검색 결과와 같은 이유로 잠근다. 타일도 같은 `choose`를 탄다. */
                disabled={choosing !== null}
                onClick={() => {
                  void choose(poi);
                }}
              >
                <Icon3d
                  name={poi.icon}
                  tone={RESULT_TONES[index % RESULT_TONES.length]}
                  size={compact ? 28 : 52}
                  iconSize={compact ? 14 : 26}
                  className={styles.tileIcon}
                />
                <div className={styles.tileBody}>
                  <div>
                    <div className={styles.tileTitle}>
                      {(QUICK_DESTINATION_LABELS[poi.name] ?? [poi.name]).map((line) => (
                        <span key={line} className={styles.tileTitleLine}>
                          {line}
                        </span>
                      ))}
                    </div>
                    <div className={styles.tileMeta}>{poi.meta}</div>
                  </div>
                  <span className={styles.tileArrow} aria-hidden>
                    ›
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
