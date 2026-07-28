import type { PermissionKey } from '@/entities/permission';
import type { Icon3dTone, IconName } from '@/shared/ui';

export type PermissionCopy = {
  key: PermissionKey;
  icon: IconName;
  tone: Icon3dTone;
  name: string;
  desc: string;
  /** Short label used inside the "all permissions needed" reminder. */
  short: string;
};

/** Copy for the three permissions, as written in the prototype. */
export const PERMISSION_CATALOG: readonly PermissionCopy[] = [
  {
    key: 'loc',
    icon: 'pin',
    tone: 'mint',
    name: '위치 정보',
    desc: '현재 역 확인과 지도 연결에 사용',
    short: '위치',
  },
  {
    key: 'cam',
    icon: 'camera',
    tone: 'coral',
    name: '카메라',
    desc: '실내 위치 확인과 길 안내에 사용',
    short: '카메라',
  },
  {
    key: 'mic',
    icon: 'mic',
    tone: 'lilac',
    name: '마이크',
    desc: '영상 상담 음성 대화에 사용',
    short: '마이크',
  },
];
