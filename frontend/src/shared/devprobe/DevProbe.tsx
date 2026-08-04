import { useEffect, useState } from 'react';
import { clearDevProbeLines, logDevProbe, useDevProbeStore } from './devProbeStore';
import styles from './DevProbe.module.css';

type DevProbeProps = {
  /**
   * 눌러서 확인할 것. 결과와 실패 사유가 로그에 남는다.
   *
   * 실기기에서만 답이 나오는 물음을 여기 둔다 — 데스크톱 콘솔로 확인되는 것은 콘솔로 본다.
   */
  actions?: Record<string, () => Promise<unknown>>;
};

/**
 * 실기기 확인용 검사 패널. **임시다.** (S15P11A206-89)
 *
 * 모바일에는 콘솔이 없다. 연결 상태·이벤트 채널·카메라 상태는 모두 화면에 적히지 않는 값인데,
 * 화면 공유가 왜 안 붙는지는 그 값들을 봐야 알 수 있었다. 자막 패널이 기존 `연결 상태:` 줄을
 * 가리고 있어 사용자 화면에서는 그마저 보이지 않았다.
 *
 * 실 서비스 UI 와 겹치지 않게 자기 자리를 스스로 만든다 — `position: fixed` 와 가장 높은
 * `z-index` 만 쓰고, 다른 화면의 클래스·변수·스토어를 건드리지 않는다. 접힌 상태에서는
 * 오른쪽 아래 모서리의 작은 손잡이 하나뿐이다.
 *
 * 지우는 방법은 이 폴더의 README.md 에 적어 두었다.
 */
export function DevProbe({ actions }: DevProbeProps) {
  const [open, setOpen] = useState(false);
  const fields = useDevProbeStore((state) => state.fields);
  const counts = useDevProbeStore((state) => state.counts);
  const lines = useDevProbeStore((state) => state.lines);

  /**
   * 삼켜지는 오류를 로그로 옮긴다.
   *
   * 모바일에서 예외가 나면 화면이 그대로 멈추고 원인을 볼 방법이 없다. 듣기만 하므로 원래
   * 오류 처리에 끼어들지 않는다.
   */
  useEffect(() => {
    const onError = (event: ErrorEvent) => logDevProbe(`error ${event.message}`);
    const onRejection = (event: PromiseRejectionEvent) =>
      logDevProbe(`rejected ${String(event.reason)}`);

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  /** 값과 로그를 한 덩어리로 복사한다. 모바일에서 본 것을 그대로 옮겨 붙일 수 있어야 한다. */
  const copy = () => {
    const text = [...fields.map(([name, value]) => `${name}: ${value}`), '', ...lines].join('\n');

    void navigator.clipboard
      ?.writeText(text)
      .then(() => logDevProbe('복사됨'))
      .catch(() => logDevProbe('복사 실패 — 길게 눌러 직접 선택'));
  };

  const run = (label: string, action: () => Promise<unknown>) => {
    logDevProbe(`${label} 요청`);

    void action()
      .then((result) => logDevProbe(`${label} → ${JSON.stringify(result)}`))
      .catch((cause: unknown) =>
        logDevProbe(`${label} 실패 → ${cause instanceof Error ? cause.message : String(cause)}`),
      );
  };

  if (!open) {
    return (
      <button type="button" className={styles.handle} onClick={() => setOpen(true)}>
        검사
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <strong className={styles.title}>실기기 검사 (임시)</strong>
        <button type="button" className={styles.button} onClick={copy}>
          복사
        </button>
        <button type="button" className={styles.button} onClick={clearDevProbeLines}>
          비우기
        </button>
        <button type="button" className={styles.button} onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>

      <dl className={styles.fields}>
        {fields.map(([name, value]) => (
          <div key={name} className={styles.field}>
            <dt className={styles.fieldName}>{name}</dt>
            <dd className={styles.fieldValue}>{value}</dd>
          </div>
        ))}
        {/* 횟수는 값 뒤에 이어 붙인다. 흐르고 있는지는 이 숫자가 오르는지로만 보인다. */}
        {Object.entries(counts).map(([name, count]) => (
          <div key={name} className={styles.field}>
            <dt className={styles.fieldName}>{name}</dt>
            <dd className={styles.fieldValue}>{count}</dd>
          </div>
        ))}
      </dl>

      {actions && (
        <div className={styles.actions}>
          {Object.entries(actions).map(([label, action]) => (
            <button
              key={label}
              type="button"
              className={styles.button}
              onClick={() => run(label, action)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.log}>
        {lines.length === 0 ? (
          <p className={styles.logEmpty}>기록 없음</p>
        ) : (
          /* 최근 것이 위로 오게 뒤집는다. 스크롤을 내리지 않고도 방금 일어난 일을 본다. */
          [...lines].reverse().map((line, index) => (
            <p key={`${index}-${line}`} className={styles.logLine}>
              {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
