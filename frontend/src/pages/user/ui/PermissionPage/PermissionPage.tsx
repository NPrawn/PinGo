import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissionStore } from '@/entities/permission';
import { PermissionList, PermissionReminder } from '@/features/permission-request';
import { USER_ROUTES } from '@/shared/config';
import { BackLink, Button, GhostButton, Kicker, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './PermissionPage.module.css';

type Modal = 'none' | 'incomplete' | 'blocked';

/** Screen 03 (FR-U-002) — permission request. */
export function PermissionPage() {
  const navigate = useNavigate();
  const hasAll = usePermissionStore((state) => state.hasAll);
  const [modal, setModal] = useState<Modal>('none');

  const start = () => {
    if (hasAll('loc', 'cam', 'mic')) {
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

      <PermissionList />

      <Spring />
      <Button onClick={start}>권한 허용하고 시작하기</Button>
      <GhostButton onClick={() => setModal('blocked')}>권한 없이 계속하기</GhostButton>

      {modal !== 'none' && (
        <PermissionReminder
          variant={modal}
          onDismiss={() => setModal('none')}
          onAllowAll={() => {
            setModal('none');
            void navigate(USER_ROUTES.STATION);
          }}
        />
      )}
    </PhoneFrame>
  );
}
