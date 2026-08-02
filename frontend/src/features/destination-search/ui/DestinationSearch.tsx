import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { PLACES, useDestinationSearch } from '@/entities/poi';
import type { Poi } from '@/entities/poi';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { findNearestExit, getFacility, getRecommendedExits, updateUserSession } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { Field, Icon3d, Kicker, SelectRow } from '@/shared/ui';
import type { Icon3dTone, IconName } from '@/shared/ui';
import styles from './DestinationSearch.module.css';

const RESULT_TONES: readonly Icon3dTone[] = ['mint', 'sky', 'coral', 'lilac', 'gold'];

/** Shortcuts shown before the user types anything. */
const QUICK_TILES = PLACES.slice(0, 4).map((place, index) => ({
  title: place.name,
  meta: place.meta,
  tone: RESULT_TONES[index % RESULT_TONES.length],
  icon: place.icon,
})) satisfies readonly {
  title: string;
  meta: string;
  tone: Icon3dTone;
  icon: IconName;
}[];

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

  const destinationSearch = useDestinationSearch(stationId, query, searched);
  const results = destinationSearch.data ?? [];

  const choose = async (poi: Poi) => {
    /**
     * 안내를 시작할 도착 노드.
     *
     * 경로 옵션 화면이 유형별로 다시 정하지만(최단·엘리베이터 우선의 출구가 다르다) 그 전에
     * 목적지가 실내 경로에 닿는지 알아야 하므로 여기서 한 번 구해 둔다.
     */
    let targetNodeId: number | undefined;

    try {
      if (poi.id != null && poi.kind === 'facility') {
        const facility = await getFacility(poi.id);
        targetNodeId = facility.linkedNodeId;
      }

      if (poi.id != null && poi.kind === 'place') {
        const exits = await getRecommendedExits(poi.id);
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
      if (poi.id == null && poi.latitude != null && poi.longitude != null && stationId != null) {
        const nearestExit = await findNearestExit({
          stationId,
          destinationLatitude: poi.latitude,
          destinationLongitude: poi.longitude,
        });
        if (nearestExit.exitFacilityId != null) {
          const facility = await getFacility(nearestExit.exitFacilityId);
          targetNodeId = facility.linkedNodeId;
        }
      }
    } catch {
      targetNodeId = undefined;
    }

    startNewJourney(poi.name, {
      destinationId: poi.id,
      destinationType: poi.destinationType ?? poi.kind,
      targetNodeId,
      destinationLatitude: poi.latitude,
      destinationLongitude: poi.longitude,
      destinationAddress: poi.address,
    });
    if (userSessionId && poi.id != null) {
      void updateUserSession(userSessionId, {
        selectedStationId: stationId ?? undefined,
        destinationId: poi.id,
        destinationType: poi.destinationType?.toLowerCase() ?? poi.kind,
      }).catch(() => undefined);
    }
    onSelect?.(poi.name);
    if (!deferNavigation) void navigate(nextRoute);
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
            {results.map((poi, index) => (
              <SelectRow
                key={poi.name}
                className={styles.result}
                indicator="none"
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
                  <span className={styles.resultMeta}>{poi.meta}</span>
                </span>
                <span className={styles.chevron}>›</span>
              </SelectRow>
            ))}
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
            {QUICK_TILES.map((tile) => (
              <button
                key={tile.title}
                type="button"
                className={styles.tile}
                onClick={() => {
                  const poi = PLACES.find((place) => place.name === tile.title);
                  if (poi) void choose(poi);
                }}
              >
                <Icon3d
                  name={tile.icon}
                  tone={tile.tone}
                  size={compact ? 28 : 52}
                  iconSize={compact ? 14 : 26}
                  className={styles.tileIcon}
                />
                <div className={styles.tileBody}>
                  <div>
                    <div className={styles.tileTitle}>{tile.title}</div>
                    <div className={styles.tileMeta}>{tile.meta}</div>
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
