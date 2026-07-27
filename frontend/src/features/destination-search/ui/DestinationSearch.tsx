import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { searchDestinations } from '@/entities/poi';
import { USER_ROUTES } from '@/shared/config';
import { Blob, Field, Icon3d, Kicker, SelectRow } from '@/shared/ui';
import type { BlobTone, Icon3dTone } from '@/shared/ui';
import styles from './DestinationSearch.module.css';

const RESULT_TONES: readonly Icon3dTone[] = ['mint', 'sky', 'coral', 'lilac', 'gold'];

/** Shortcuts shown before the user types anything. */
const QUICK_TILES: readonly { title: string; meta: string; tone: BlobTone }[] = [
  { title: '화장실', meta: 'Restroom · 4곳', tone: 'mint' },
  { title: '승강장', meta: 'Platform · 1-14', tone: 'coral' },
  { title: '편의점', meta: 'Store · 6곳', tone: 'lilac' },
  { title: '출구', meta: 'Exit · 1-8', tone: 'sky' },
];

/**
 * Destination search with quick-access tiles.
 *
 * TODO: `searchDestinations` filters a fixture list. Replace with the search
 * endpoint once its contract is agreed.
 */
export function DestinationSearch() {
  const navigate = useNavigate();
  const setDestination = useNavigationStore((state) => state.setDestination);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const results = searchDestinations(query);

  const choose = (name: string) => {
    setDestination(name);
    void navigate(USER_ROUTES.DESTINATION_MAP);
  };

  return (
    <>
      <div className={styles.searchWrap}>
        <Field
          big
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
                onClick={() => choose(poi.name)}
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
            {results.length === 0 && (
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
              <Link
                key={tile.title}
                to={USER_ROUTES.DESTINATION_MAP}
                className={styles.tile}
                onClick={() => setDestination(tile.title)}
              >
                <Blob tone={tile.tone} className={styles.tileBlob} />
                <div>
                  <div className={styles.tileTitle}>{tile.title}</div>
                  <div className={styles.tileMeta}>{tile.meta}</div>
                </div>
                <span className={styles.tileArrow} aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
