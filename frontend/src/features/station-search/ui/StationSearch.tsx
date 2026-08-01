import { useState } from 'react';
import { STATIONS, searchStations, useStationStore } from '@/entities/station';
import type { Station } from '@/entities/station';
import { Blob, Field, Kicker, SelectRow } from '@/shared/ui';
import type { BlobTone } from '@/shared/ui';
import styles from './StationSearch.module.css';

/** Accent cycle for the nearby list; the detected station stays mint. */
const TONES: readonly BlobTone[] = ['mint', 'sky', 'coral', 'lilac'];

type StationSearchProps = {
  onSelect?: (station: string) => void;
};

/**
 * Nearby-station list with a name search.
 *
 * TODO: `STATIONS` is a fixture. Swap for the GPS + station lookup APIs once
 * those contracts land.
 */
export function StationSearch({ onSelect }: StationSearchProps) {
  const station = useStationStore((state) => state.station);
  const setStation = useStationStore((state) => state.setStation);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const results = searchStations(query);
  const showResults = searched;

  const renderRow = (item: Station, tone: BlobTone) => {
    /**
     * 백엔드 id가 없는 역은 고를 수 없다.
     *
     * 고르게 두면 지도·시설·경로 조회를 걸 수 없는 상태로 흐름에 들어간다. 조회를 끈 쿼리는
     * `pending`에 머무르므로 뒤 화면들은 "아직 물어볼 수 없다"와 "물어보는 중"을 구분하지
     * 못하고 로딩 문구에 갇힌다. 흐름에 들어가기 전에 막는 편이 확실하다.
     */
    const registered = item.stationId !== null;

    return (
      <SelectRow
        key={item.name}
        className={styles.row}
        selected={item.name === station}
        indicator={item.here || !registered ? 'none' : 'check'}
        disabled={!registered}
        onClick={
          registered
            ? () => {
                setStation(item.name, item.stationId);
                onSelect?.(item.name);
              }
            : undefined
        }
      >
        <Blob tone={tone} style={{ width: 28, height: 28 }} />
        <span className={styles.rowBody}>
          <b className={styles.name}>{item.name}</b>{' '}
          <span className={styles.line}>{item.line}</span>
          <br />
          <span className={styles.dist}>{item.dist}</span>
        </span>
        {item.here && <span className={styles.hereBadge}>현위치</span>}
        {!registered && <span className={styles.pendingBadge}>준비 중</span>}
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
            {results.length === 0 && (
              <div className={styles.empty}>일치하는 역이 없어요. 다른 이름으로 검색해보세요.</div>
            )}
          </div>
        </>
      ) : (
        <>
          <Kicker className={styles.sectionLabel}>주변 역 · GPS 기반 추천</Kicker>
          <div className={styles.list}>
            {STATIONS.map((item, index) =>
              renderRow(item, item.here ? 'mint' : TONES[index % TONES.length]),
            )}
          </div>
        </>
      )}
    </>
  );
}
