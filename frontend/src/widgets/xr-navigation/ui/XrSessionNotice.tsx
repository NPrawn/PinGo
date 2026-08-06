import type { XrFailureReason, XrSupport, XrTrackingStatus } from '@/shared/lib/webxr';
import { Button, GhostButton, Icon, Sheet } from '@/shared/ui';
import styles from './XrSessionNotice.module.css';

interface XrSessionNoticeProps {
  /** 지원 탐지 결과. 끝나기 전에는 null이다. */
  support: XrSupport | null;
  /** 현재 추적 상태. `failed`면 실패 안내로 바뀐다. */
  status: XrTrackingStatus;
  /** `status`가 `failed`일 때의 사유. */
  reason?: XrFailureReason;
  /** 재시도해도 결과가 달라질 수 있는지. 11.7 기준이다. */
  canRetry: boolean;
  /** 세션을 연다. */
  onConfirm: () => void;
  /** 추적 없이 안내를 계속한다. */
  onContinueWithoutTracking: () => void;
}

/**
 * 세션을 열기 전에 표시하는 앱 자체 안내. (S15P11A206-141)
 *
 * 11.7이 확정한 세 가지를 그대로 옮긴다.
 *
 * 1. 경로 안내 진입 시 세션을 **자동으로 열지 않는다.** 이 안내를 먼저 보여준다.
 * 2. 미지원·권한 차단에는 **재시도 수단을 두지 않는다.** 재시도해도 결과가 같다.
 *
 * **카메라 권한을 새로 받는 창이 아니다.** 카메라는 앱 진입 직후 위치·마이크와 함께 이미
 * 받았다(`화면_흐름도.md` 5.2). 여기서 묻는 것은 그 카메라로 실시간 추적을 켤지이며, 문구가
 * 권한을 처음 요청하는 것처럼 읽히면 사용자는 같은 것을 두 번 묻는다고 받아들인다.
 *
 * 그런데도 시스템 확인이 뜨는 이유는 **AR 세션 동의가 카메라 권한으로 갈음되지 않기**
 * 때문이다(11.7 실측 — 카메라가 허용된 상태에서도 별도 프롬프트가 떴고, AR 동의와
 * `camera-access` 동의도 서로 별개라 초기화 직후에는 두 개가 연달아 뜬다). 둘 다 origin에
 * 저장되므로 사용자는 앱 최초 1회만 본다.
 *
 * 동의 상태를 미리 조회할 수 없으므로(`permissions.query`가 Chrome 150에서 throw) 이미
 * 허용한 사용자에게도 이 안내가 뜬다. 그 경우 확인을 누르면 프롬프트 없이 바로 세션이 열린다
 * (실측 185ms).
 *
 * **어느 쪽을 골라도 경로 안내는 계속된다.** 거부는 영구적이고 앱 안에서 되돌릴 수 없으므로,
 * 추적 없이도 안내가 완결되어야 한다는 원칙이 우선이다(11.7).
 */
export function XrSessionNotice({
  support,
  status,
  reason,
  canRetry,
  onConfirm,
  onContinueWithoutTracking,
}: XrSessionNoticeProps) {
  const { t } = useTranslation();
  const failed = status === 'failed';
  const unavailable = support === 'no-xr-object' || support === 'unsupported';
  const content = failed
    ? failureContent(reason, t)
    : unavailable
      ? unavailableContent(t)
      : introContent(t);

  /**
   * 지원 탐지가 끝나기 전.
   *
   * 이 구간에 시작 버튼을 활성해 두면 미지원 기기에서 문구가 "시작할 수 있음"에서
   * "쓸 수 없음"으로 깜빡인다. 탐지는 세션을 열지 않아 프롬프트가 뜨지 않으므로,
   * 끝날 때까지 기다리는 편이 사용자에게 한 가지 사실만 보여준다.
   */
  const checking = !failed && support === null;

  /**
   * 세션을 시도할 수 있는 경우에만 확인 버튼을 둔다.
   *
   * 실패 후에는 `canRetry`를 따른다 — `permission-blocked`와 미지원은 눌러도 같은 결과라
   * 버튼을 두면 사용자를 반복 실패에 묶어 둔다(11.7).
   */
  const canStart = failed ? canRetry : !unavailable;

  return (
    <Sheet placement="center" label={content.title}>
      <div className={styles.panel}>
        {/* 권한 안내 모달(`PermissionReminder`)과 같은 어휘다. 같은 흐름에서 연달아 보이는
            창이라 모양이 어긋나면 다른 앱처럼 보인다. */}
        <div className={[styles.mark, styles[content.tone]].join(' ')}>
          <Icon name={content.icon} size={28} />
        </div>

        <h2 className={styles.title}>{content.title}</h2>
        <p className={styles.description}>{content.description}</p>

        <div className={styles.actions}>
          {checking ? (
            <>
              <Button disabled>{t('user.xr.checkingDevice')}</Button>
              <GhostButton onClick={onContinueWithoutTracking} className={styles.skip}>
                {t('user.xr.continueMap')}
              </GhostButton>
            </>
          ) : canStart ? (
            <>
              <Button onClick={onConfirm}>
                <Icon name={failed ? 'refresh' : 'camera'} size={17} />
                {failed ? t('user.xr.retry') : t('user.xr.start')}
              </Button>
              <GhostButton onClick={onContinueWithoutTracking} className={styles.skip}>
                {t('user.xr.continueMap')}
              </GhostButton>
            </>
          ) : (
            /*
              켤 수 없는 기기에서는 이것이 유일한 선택지다.

              고스트로 두면 다른 모달의 보조 링크와 같은 모양이라, 누를 것이 없는 안내 창처럼
              보인다. 이 흐름의 다른 모달(권한 안내·촬영 실패)은 모두 채워진 버튼을 하나씩
              두고 있으므로 여기서도 기본 버튼으로 낸다.
            */
            <Button onClick={onContinueWithoutTracking}>
              <Icon name="map" size={17} />
              {t('user.xr.mapOnly')}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

interface NoticeContent {
  title: string;
  description: string;
  icon: 'camera' | 'warning' | 'info';
  tone: 'mint' | 'coral';
}

/**
 * 최초 진입 안내.
 *
 * **카메라를 새로 요청하는 문구를 쓰지 않는다.** 카메라는 5.2에서 이미 받았고, 여기서 정하는
 * 것은 그 카메라로 실시간 추적을 켤지다.
 *
 * **시스템 확인이 두 개 뜬다는 설명도 넣지 않는다.** 그 일은 앱 최초 1회에만 일어나고
 * (두 동의 모두 origin에 저장된다) 그 뒤로는 프롬프트 자체가 없다. 대부분의 진입에서
 * 일어나지 않는 일을 매번 설명하면 정작 물어보는 것이 묻힌다. 실제로 뜨는 경우에는 시스템
 * 대화상자가 스스로 무엇을 묻는지 알려준다.
 */
function introContent(t: TFunction): NoticeContent {
  return {
    title: t('user.xr.introTitle'),
    description: t('user.xr.introDescription'),
    icon: 'camera',
    tone: 'mint',
  };
}

/** `immersive-ar`을 쓸 수 없는 기기·브라우저. iOS Safari가 이 경로다(11.7). */
function unavailableContent(t: TFunction): NoticeContent {
  return {
    title: t('user.xr.unavailableTitle'),
    description: t('user.xr.unavailableDescription'),
    icon: 'info',
    tone: 'coral',
  };
}

/**
 * 세션 시작 실패 안내.
 *
 * 사유별로 사용자가 할 수 있는 일이 다르다. `permission-blocked`는 앱 안에서 되돌릴 수 없어
 * 브라우저 사이트 설정을 안내하는 것 외에 방법이 없다(11.7).
 */
function failureContent(reason: XrFailureReason | undefined, t: TFunction): NoticeContent {
  /**
   * 여기서 막힌 것은 **AR 사용 동의**다. 카메라 권한은 이미 허용돼 있으므로 "카메라 권한이
   * 차단됐다"고 쓰면 사용자가 초기 권한 화면을 다시 찾아간다.
   */
  if (reason === 'permission-blocked') {
    return {
      title: t('user.xr.blockedTitle'),
      description: t('user.xr.blockedDescription'),
      icon: 'warning',
      tone: 'coral',
    };
  }

  if (reason === 'no-xr-object' || reason === 'unsupported') {
    return unavailableContent(t);
  }

  return {
    title: t('user.xr.failedTitle'),
    description: t('user.xr.failedDescription'),
    icon: 'warning',
    tone: 'coral',
  };
}
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
