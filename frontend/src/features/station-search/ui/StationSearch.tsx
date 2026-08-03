import { useEffect, useState } from 'react';
import {
  useNearbyStations,
  useRegisteredStations,
  useStationSearch,
  useStationStore,
} from '@/entities/station';
import type { Station } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { updateUserSession } from '@/shared/api';
import { readRecentLocation, saveLocation } from '@/shared/lib/location-cache';
import { Blob, Field, Kicker, SelectRow } from '@/shared/ui';
import type { BlobTone } from '@/shared/ui';
import styles from './StationSearch.module.css';

/** Accent cycle for the nearby list; the detected station stays mint. */
const TONES: readonly BlobTone[] = ['mint', 'sky', 'coral', 'lilac'];

/** Prototype GPS recommendations that are visible while indoor guidance is unavailable. */
const DISPLAY_ONLY_NEARBY_STATIONS: readonly Station[] = [
  {
    stationId: null,
    name: '선릉역',
    line: '2호선·수인분당선',
    dist: '420m',
    serviceReady: false,
  },
  {
    stationId: null,
    name: '강남역',
    line: '2호선·신분당선',
    dist: '1.1km',
    serviceReady: false,
  },
];

type StationSearchProps = {
  onSelect?: (station: string) => void;
};

/**
 * Nearby-station list with a name search.
 *
 * 검색은 역 검색 API를, 위치 권한이 허용된 경우 주변 목록은 GPS API를 사용한다.
 * 역 검색 API는 등록된 역과 외부(카카오) 지하철역 결과를 함께 내려준다. 후자는 실내 지도가
 * 없어 선택할 수 없고 "준비 중"으로만 보여준다.
 */
export function StationSearch({ onSelect }: StationSearchProps) {
  const station = useStationStore((state) => state.station);
  const setStation = useStationStore((state) => state.setStation);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [coordinates, setCoordinates] = useState(() => readRecentLocation());

  const stationSearch = useStationSearch(query, searched);
  const nearbySearch = useNearbyStations(coordinates?.latitude, coordinates?.longitude);
  const hasNearby = (nearbySearch.data?.length ?? 0) > 0;
  // GPS를 못 쓰거나 주변에 등록된 역이 없으면 등록된 역 전체를 대신 보여준다.
  const registeredStations = useRegisteredStations(!hasNearby);
  const results = stationSearch.data ?? [];
  const nearbyStations = hasNearby ? nearbySearch.data! : (registeredStations.data ?? []);
  const visibleNearbyStations = hasNearby
    ? [
        ...nearbyStations,
        ...DISPLAY_ONLY_NEARBY_STATIONS.filter(
          (candidate) => !nearbyStations.some((item) => item.name === candidate.name),
        ),
      ].slice(0, 3)
    : nearbyStations;
  // 검색어가 비면 쿼리를 켜지 않으므로 결과 영역도 열지 않는다.
  const showResults = searched && query.trim().length > 0;
  const hasUnavailableResult = results.some((item) => item.serviceReady === false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        saveLocation(position);
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          capturedAt: position.timestamp || Date.now(),
        });
      },
      undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const renderRow = (item: Station, tone: BlobTone) => {
    /**
     * 고를 수 없는 역.
     *
     * 백엔드 id가 없거나(외부 검색에만 있는 역) 실내 데이터가 준비되지 않은 역이다. 고르게
     * 두면 지도·시설·경로 조회를 걸 수 없는 상태로 흐름에 들어간다. 조회를 끈 쿼리는
     * `pending`에 머무르므로 뒤 화면들은 "아직 물어볼 수 없다"와 "물어보는 중"을 구분하지
     * 못하고 로딩 문구에 갇힌다. 흐름에 들어가기 전에 막는 편이 확실하다.
     */
    const unavailable = item.stationId == null || item.serviceReady === false;

    return (
      <SelectRow
        key={`${item.name}-${item.stationId ?? 'external'}`}
        className={[styles.row, unavailable && styles.rowUnavailable].filter(Boolean).join(' ')}
        selected={!unavailable && item.name === station}
        indicator={item.here || unavailable ? 'none' : 'check'}
        disabled={unavailable}
        onClick={
          unavailable
            ? undefined
            : () => {
                setStation(item.name, item.stationId);
                if (userSessionId && item.stationId != null) {
                  void updateUserSession(userSessionId, {
                    selectedStationId: item.stationId,
                  }).catch(() => undefined);
                }
                onSelect?.(item.name);
              }
        }
      >
        <Blob tone={unavailable ? 'lilac' : tone} style={{ width: 28, height: 28 }} />
        <span className={styles.rowBody}>
          <b className={styles.name}>{item.name}</b>{' '}
          <span className={styles.line}>{item.line}</span>
          <br />
          <span className={styles.dist}>{item.dist}</span>
        </span>
        {item.here && <span className={styles.hereBadge}>현위치</span>}
        {unavailable && <span className={styles.soonBadge}>준비 중</span>}
      </SelectRow>
    );
  };

  return (
    <>
      <div className={styles.searchWrap}>
        <Field
          big
          placeholder="역 이름 검색 (예: 역삼)"
          aria-label="역 이름 검색"
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

      {showResults ? (
        <>
          <Kicker className={styles.sectionLabel}>검색 결과 · &quot;{query}&quot;</Kicker>
          <div className={styles.list}>
            {results.map((item) => renderRow(item, 'lilac'))}
            {stationSearch.isPending && <div className={styles.empty}>검색하고 있어요…</div>}
            {stationSearch.isError && (
              <div className={styles.empty}>역 목록을 불러오지 못했어요.</div>
            )}
            {!stationSearch.isPending && !stationSearch.isError && results.length === 0 && (
              <div className={styles.empty}>일치하는 역이 없어요. 다른 이름으로 검색해보세요.</div>
            )}
            {hasUnavailableResult && (
              <div className={styles.empty}>
                &lsquo;준비 중&rsquo; 역은 실내 지도를 아직 준비하지 않아 선택할 수 없어요.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <Kicker className={styles.sectionLabel}>
            {hasNearby ? '주변 역 · GPS 기반 추천' : '실내 안내가 준비된 역'}
          </Kicker>
          <div className={styles.list}>
            {visibleNearbyStations.map((item, index) =>
              renderRow(item, item.here ? 'mint' : TONES[index % TONES.length]),
            )}
            {visibleNearbyStations.length === 0 && (
              <div className={styles.empty}>역 이름을 검색해 출발지를 골라주세요.</div>
            )}
          </div>
        </>
      )}
    </>
  );
}
