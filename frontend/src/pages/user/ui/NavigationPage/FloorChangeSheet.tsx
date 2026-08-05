import { useTranslation } from 'react-i18next';
import { Button, GhostButton, Icon, Sheet } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import styles from './FloorChangeSheet.module.css';

interface FloorChangeSheetProps {
  /** 도착층 코드. `B2`처럼 그대로 문구에 들어간다. */
  toFloorCode: string;
  /** 오르내리는 층수. 위로 가면 양수다. 모르면 null — 그때는 방향을 말하지 않는다. */
  floorDelta: number | null;
  /** `stair` · `escalator` · `elevator`. 아이콘과 문구를 가른다. */
  moveType: string | null;
  /** 이동을 마쳤다. 도착층 노드로 위치를 옮긴다. */
  onComplete: () => void;
  /** 닫는다. 이동 완료가 아니므로 위치를 옮기지 않는다. */
  onDismiss: () => void;
}

/**
 * 층을 오르내리는 동안 띄우는 안내. (S15P11A206-351)
 *
 * <p><b>왜 버튼으로 받는가.</b> 표시 층은 측위 좌표를 따르는데, 계단·엘리베이터를 타는 동안
 * 측위는 이전 층에 머문다 — WebXR 추적은 수직 이동을 따라가지 못하고 재인식도 걸리지 않는다.
 * 그래서 다 올라간 뒤에도 지도가 출발층에 남았고 사용자가 층 탭을 직접 눌러야 했다. 도착을
 * 사용자에게 물어 그 시점에 층을 넘긴다.
 *
 * <p>서버가 이 화면을 띄울 자리를 알려준다 — 단계의 {@code type}이 {@code floor_change}이고
 * {@code toFloorCode}가 도착층이다. 같은 층 안에서 오르내리는 구간(역삼역 B0.5)은 그 값이
 * {@code walk}라 여기 오지 않는다. 지도가 바뀌지 않는 자리에서 이 화면을 띄우면 사용자는
 * 넘어갈 층이 없는 화면을 닫아야 한다.
 *
 * <p><b>닫기를 둔다.</b> 자동으로 뜨는 화면이라, 아직 이동하지 않았는데 떴을 때 빠져나갈 길이
 * 없으면 지도를 볼 수 없다. 닫아도 진행도가 그 구간에 오면 다시 뜬다.
 */
export function FloorChangeSheet({
  toFloorCode,
  floorDelta,
  moveType,
  onComplete,
  onDismiss,
}: FloorChangeSheetProps) {
  const { t } = useTranslation();

  /**
   * 방향을 문구로 가른다. `floorDelta`가 없으면 방향을 말하지 않는다 — 층 순서를 모르는데
   * "올라가기"로 단정하면 반대로 안내하게 된다.
   */
  const direction = floorDelta == null ? 'move' : floorDelta > 0 ? 'up' : 'down';
  const title = t(`user.navigation.floorChange.title.${direction}`, { floor: toFloorCode });

  return (
    <Sheet placement="center" label={title} onDismiss={onDismiss}>
      <div className={styles.panel}>
        <p className={styles.badge}>{t('user.navigation.floorChange.arrivalFloor')}</p>

        <span className={styles.icon} aria-hidden>
          <Icon name={iconOf(moveType)} size={40} />
        </span>

        <strong className={styles.floor}>{toFloorCode}</strong>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.help}>{t('user.navigation.floorChange.help')}</p>

        <Button onClick={onComplete} className={styles.confirm}>
          <Icon name="check" size={16} />
          {t('user.navigation.floorChange.complete')}
        </Button>
        <GhostButton onClick={onDismiss}>{t('user.navigation.floorChange.later')}</GhostButton>
      </div>
    </Sheet>
  );
}

/** 이동 수단 아이콘. 알 수 없으면 계단으로 둔다 — 층 이동 중 가장 흔한 수단이다. */
function iconOf(moveType: string | null): IconName {
  if (moveType === 'elevator') return 'elevator';
  if (moveType === 'escalator') return 'escalator';
  return 'stairs';
}
