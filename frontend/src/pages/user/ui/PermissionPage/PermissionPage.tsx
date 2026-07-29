import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePermissionStore,
  type PermissionKey,
  type PermissionState,
} from '@/entities/permission';
import {
  PermissionList,
  PermissionReminder,
  type PermissionRowState,
} from '@/features/permission-request';
import {
  usePermissionRequest,
  type PermissionStatus,
  type RequiredPermissionStatuses,
} from '@/features/permissions';
import { USER_ROUTES } from '@/shared/config';
import { BackLink, Button, Kicker, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './PermissionPage.module.css';

type Modal = 'none' | 'incomplete';

/**
 * Only a granted permission fills its circle. Denied, unsupported and error all
 * keep the user out of the service, so they read the same on screen.
 */
function toRowState(status: PermissionStatus): PermissionRowState {
  if (status === 'granted') {
    return 'granted';
  }

  return status === 'idle' ? 'idle' : 'blocked';
}

function toRowStates(
  statuses: RequiredPermissionStatuses,
): Record<PermissionKey, PermissionRowState> {
  return {
    loc: toRowState(statuses.location),
    cam: toRowState(statuses.camera),
    mic: toRowState(statuses.microphone),
  };
}

/**
 * The browser's verdict in the shared store's format.
 *
 * Everything short of `granted` counts as false, including a permission that
 * was never asked because an earlier one was refused. That way a permission the
 * user revoked since the last request cannot stay switched on, and the store
 * never claims more access than this request confirmed.
 */
function toPermissionState(statuses: RequiredPermissionStatuses): PermissionState {
  return {
    loc: statuses.location === 'granted',
    cam: statuses.camera === 'granted',
    mic: statuses.microphone === 'granted',
  };
}

/** Screen 03 (FR-U-002) — permission request. */
export function PermissionPage() {
  const navigate = useNavigate();
  const syncPermissions = usePermissionStore((state) => state.sync);
  const { requestPermissions, isRequesting, statuses } = usePermissionRequest();
  const [modal, setModal] = useState<Modal>('none');

  /**
   * Answering the browser prompts takes as long as the user needs, and they can
   * leave the screen in the meantime.
   */
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Runs the real browser prompts, location first and camera + microphone
   * after. Each row fills in as its answer arrives.
   *
   * The service is all-or-nothing: only with all three granted does the flow
   * continue to the station screen. Anything else keeps the user here.
   */
  const start = async () => {
    setModal('none');

    const result = await requestPermissions();

    // Keep the shared UI state in step with what the browser decided, so the
    // consult and settings screens do not contradict this one. This is global
    // state, so it is worth recording even if the screen is gone.
    syncPermissions(
      toPermissionState({
        location: result.location.status,
        camera: result.camera.status,
        microphone: result.microphone.status,
      }),
    );

    // Navigating or opening a dialog only makes sense while the user is still
    // on this screen — they may have gone back while a prompt was open.
    if (!isMountedRef.current) {
      return;
    }

    if (result.canUseService) {
      void navigate(USER_ROUTES.STATION);
      return;
    }

    setModal('incomplete');
  };

  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.LANGUAGE}>언어 선택</BackLink>
      <Kicker className={styles.kicker}>시작하기</Kicker>
      <Title>
        이용에 필요한 권한을
        <br />
        허용해 주세요
      </Title>
      <Sub>
        위치 안내와 영상 상담에 <b className={styles.strong}>세 가지 권한이 필요해요.</b>
      </Sub>

      <PermissionList states={toRowStates(statuses)} />

      <Spring />
      <Button onClick={() => void start()} disabled={isRequesting}>
        {isRequesting ? '권한 요청 중…' : '권한 허용하고 시작하기'}
      </Button>

      {modal !== 'none' && (
        <PermissionReminder
          variant={modal}
          onDismiss={() => setModal('none')}
          onAllowAll={() => void start()}
        />
      )}
    </PhoneFrame>
  );
}
