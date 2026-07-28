import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissionStore, type PermissionKey } from '@/entities/permission';
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
import { BackLink, Button, GhostButton, Kicker, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './PermissionPage.module.css';

type Modal = 'none' | 'incomplete' | 'blocked';

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

/** The permissions the browser actually granted, in the store's key format. */
function grantedKeys(statuses: RequiredPermissionStatuses): PermissionKey[] {
  const byKey: [PermissionKey, PermissionStatus][] = [
    ['loc', statuses.location],
    ['cam', statuses.camera],
    ['mic', statuses.microphone],
  ];

  return byKey.filter(([, status]) => status === 'granted').map(([key]) => key);
}

/** Screen 03 (FR-U-002) — permission request. */
export function PermissionPage() {
  const navigate = useNavigate();
  const grant = usePermissionStore((state) => state.grant);
  const { requestPermissions, isRequesting, statuses } = usePermissionRequest();
  const [modal, setModal] = useState<Modal>('none');

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
    const granted = grantedKeys({
      location: result.location.status,
      camera: result.camera.status,
      microphone: result.microphone.status,
    });

    // Keep the shared UI state in step with what the browser decided, so the
    // consult and settings screens do not contradict this one.
    if (granted.length > 0) {
      grant(...granted);
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
      <GhostButton onClick={() => setModal('blocked')} disabled={isRequesting}>
        권한 없이 계속하기
      </GhostButton>

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
