import { useState } from 'react';
import { CONSULT_HISTORY, speakerColor } from '@/entities/consult';
import { Button, Icon, PillButton, SelectField } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './HistoryPage.module.css';

/**
 * Screen 31 — past consultations.
 *
 * TODO: The date filters are presentational, matching the prototype. Wire them
 * to the history endpoint once its query parameters are agreed.
 */
export function HistoryPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <CounselorConsoleShell>
      <div className={styles.body}>
        <div>
          <h2 className={styles.heading}>상담 내역</h2>
          <p className={styles.lede}>날짜별로 필터링해서 확인할 수 있어요</p>
        </div>

        <div className={styles.filters}>
          <SelectField className={styles.select} aria-label="연도" defaultValue="2026년">
            <option>2026년</option>
            <option>2025년</option>
          </SelectField>
          <SelectField className={styles.select} aria-label="월" defaultValue="07월">
            <option>07월</option>
            <option>06월</option>
            <option>05월</option>
          </SelectField>
          <SelectField className={styles.select} aria-label="일" defaultValue="전체 일">
            <option>전체 일</option>
            <option>18일</option>
            <option>17일</option>
          </SelectField>
          <div className={styles.filterActions}>
            <Button size="sm" className={styles.filterButton}>
              <Icon name="search" size={14} />
              조회
            </Button>
            <Button size="sm" variant="secondary" className={styles.filterButton}>
              초기화
            </Button>
          </div>
        </div>

        <div className={styles.list}>
          {CONSULT_HISTORY.map((entry, index) => {
            const open = openIndex === index;
            return (
              <div key={`${entry.agent}-${entry.date}-${index}`} className={styles.entry}>
                <div className={styles.entryHead}>
                  <span className={styles.agent}>상담 담당자: {entry.agent}</span>
                  <span className={styles.date}>{entry.date}</span>
                </div>

                <div className={styles.summary}>
                  <span className={styles.summaryIcon}>
                    <Icon name="sparkle" size={14} />
                  </span>
                  <b className={styles.summaryText}>{entry.summary}</b>
                </div>

                <div className={styles.facts}>
                  <span className={styles.factLabel}>출발 위치</span>
                  <b className={styles.factValue}>{entry.from}</b>
                  <span className={styles.factLabel}>이용 출구</span>
                  <b className={styles.factValue}>{entry.exit}</b>
                  <span className={styles.factLabel}>희망 경로 옵션</span>
                  <b className={styles.factValue}>{entry.option}</b>
                  <span className={styles.factLabel}>사용 언어</span>
                  <b className={styles.factValue}>{entry.lang}</b>
                </div>

                <PillButton
                  className={styles.toggle}
                  onClick={() => setOpenIndex(open ? null : index)}
                >
                  {open ? '상담 내용 접기 ▲' : '상담 내용 자세히 살펴보기 ▼'}
                </PillButton>

                {open && (
                  <div className={styles.transcript}>
                    <div className={styles.transcriptLabel}>
                      <Icon name="chat" size={12} />
                      상담 전체 기록 · STT
                    </div>
                    {entry.log.map((line, lineIndex) => (
                      <div key={lineIndex}>
                        <span className={styles.speaker} style={{ color: speakerColor(line.who) }}>
                          {line.who}
                        </span>
                        <br />
                        <span className={styles.line}>{line.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
