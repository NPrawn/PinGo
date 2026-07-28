import {
  AVERAGE_SATISFACTION,
  HOURLY_VOLUME,
  ISSUE_BREAKDOWN,
  LANGUAGE_BREAKDOWN,
  STAT_TILES,
  TOP_EXITS,
} from '@/entities/consult';
import { Pill } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './StatsPage.module.css';

/** Screen 31-1 — the counselor analytics dashboard. */
export function StatsPage() {
  return (
    <CounselorConsoleShell>
      <div className={styles.body}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.heading}>상담 통계</h2>
            <p className={styles.lede}>역삼역 · 2026년 07월 (최근 30일)</p>
          </div>
          <div className={styles.ranges}>
            <Pill on>이번 달</Pill>
            <Pill>지난 달</Pill>
            <Pill>주간</Pill>
          </div>
        </div>

        <div className={styles.tiles}>
          {STAT_TILES.map((tile) => (
            <div key={tile.label} className={styles.card}>
              <div className={styles.tileLabel}>{tile.label}</div>
              <div
                className={[styles.tileValue, tile.highlight && styles.tileHighlight]
                  .filter(Boolean)
                  .join(' ')}
              >
                {tile.value}
                {tile.unit && <span className={styles.tileUnit}>{tile.unit}</span>}
                {tile.delta && <span className={styles.tileDelta}>{tile.delta}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.split}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>문제 유형별 상담 비중</div>
            <div className={styles.bars}>
              {ISSUE_BREAKDOWN.map((bar) => (
                <div key={bar.label}>
                  <div className={styles.barHead}>
                    <span>{bar.label}</span>
                    <b>{bar.pct}%</b>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${bar.pct}%`, background: bar.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>언어 분포</div>
            <div className={styles.langRows}>
              {LANGUAGE_BREAKDOWN.map((lang) => (
                <div key={lang.code} className={styles.langRow}>
                  <span className={styles.langLabel}>
                    {lang.code}
                    <span className={styles.langName}>{lang.label}</span>
                  </span>
                  <div className={styles.langTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${lang.pct}%`, background: lang.color }}
                    />
                  </div>
                  <b>{lang.pct}%</b>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.split}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>시간대별 상담 건수</div>
            <div className={styles.columns}>
              {HOURLY_VOLUME.map((slot) => (
                <div key={slot.label} className={styles.column}>
                  <div
                    className={styles.columnBar}
                    style={{ height: `${slot.pct}%`, background: slot.color }}
                  />
                  <span className={styles.columnLabel}>{slot.label}</span>
                </div>
              ))}
            </div>
            <p className={styles.note}>점심(12-14시)·퇴근(18-21시) 시간대에 상담이 집중돼요.</p>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>가장 많이 안내한 출구</div>
            <div className={styles.exitRows}>
              {TOP_EXITS.map((exit) => (
                <div key={exit.rank} className={styles.exitRow}>
                  <span className={styles.exitRank}>{exit.rank}</span>
                  <span>{exit.name}</span>
                  <b>{exit.count}</b>
                </div>
              ))}
            </div>

            <div className={styles.satTitle}>평균 만족도</div>
            <div className={styles.satRow}>
              <span className={styles.satScore}>{AVERAGE_SATISFACTION.score}</span>
              <span className={styles.satStars}>★★★★★</span>
              <span className={styles.satMeta}>{AVERAGE_SATISFACTION.responses}</span>
            </div>
          </div>
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
