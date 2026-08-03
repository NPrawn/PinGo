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
  permissionNamesOf,
  type PermissionRowState,
} from '@/features/permission-request';
import {
  hasKnownPermissionState,
  usePermissionRequest,
  type PermissionKind,
  type PermissionStatus,
  type RequiredPermissionStatuses,
} from '@/features/permissions';
import { USER_ROUTES } from '@/shared/config';
import { BackLink, Button, Kicker, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './PermissionPage.module.css';

type Modal = 'none' | 'incomplete';

/**
 * 브라우저가 정해진 시간 안에 답을 주지 않은 경우.
 *
 * 거부당한 것과는 다르다. 대개는 권한 팝업이 아직 열린 채 답을 기다리는 중이므로, 팝업을
 * 먼저 찾게 한다. 크롬은 팝업을 지나치면 주소창 오른쪽 카메라 아이콘으로 접어 둔다.
 * 그래도 답이 없으면 같은 사이트를 열어 둔 다른 탭이 장치를 잡고 있는 경우다.
 */
const TIMEOUT_HINT =
  '브라우저 권한 팝업에서 [허용]을 눌러 주세요. 팝업이 보이지 않으면 주소창 오른쪽 카메라 아이콘을 눌러 허용할 수 있어요. 그래도 안 되면 이 사이트를 열어 둔 다른 탭을 모두 닫아 주세요.';

/**
 * 다른 곳이 카메라·마이크를 쓰고 있어 열지 못한 경우.
 *
 * 거부당한 것이 아니다. 권한은 멀쩡한데 장치를 잡을 수 없을 뿐이라, "허용해 주세요"라고 하면
 * 사용자는 이미 허용된 설정만 들여다보게 된다.
 */
const DEVICE_BUSY_HINT =
  '카메라나 마이크를 다른 앱 또는 다른 탭이 사용하고 있어요. 그곳을 닫은 뒤 다시 시도해 주세요.';

/** 브라우저마다 이름이 다르다. 어느 쪽이든 "거부"가 아니라 "지금은 못 연다"는 뜻이다. */
const DEVICE_BUSY_ERRORS = ['NotReadableError', 'AbortError', 'TrackStartError'];

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

/** 권한 요청 쪽 이름과 화면 쪽 이름을 잇는다. 같은 권한을 두 이름으로 부른다. */
const ROW_KEY_OF: Record<PermissionKind, PermissionKey> = {
  location: 'loc',
  camera: 'cam',
  microphone: 'mic',
};

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
  const {
    requestPermissions,
    isRequesting,
    statuses,
    phase,
    browserStates,
    blockedKinds,
    promptableKinds,
    canUseService,
  } = usePermissionRequest();
  const [modal, setModal] = useState<Modal>('none');
  const [hint, setHint] = useState('');

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

  // Keep the shared UI state in step with what the browser decided, so the
  // consult and settings screens do not contradict this one. This is global
  // state, so it is worth recording even if the screen is gone.
  useEffect(() => {
    syncPermissions(toPermissionState(statuses));
  }, [statuses, syncPermissions]);

  /**
   * 세 권한이 갖춰지면 넘어간다.
   *
   * 버튼을 눌러 받아 낸 경우만이 아니다. 거부해서 막힌 사용자가 브라우저 설정에서 권한을
   * 켜면 훅이 그 변화를 잡아 여기까지 이어지므로, 새로고침하거나 버튼을 다시 누를 필요가
   * 없다. **누른 적이 없어도 넘어간다** — 안내를 따라 설정을 바꾼 사용자에게 그 다음으로
   * 무엇을 눌러야 하는지 또 알려 줄 방법이 없기 때문이다.
   *
   * `replace`인 이유는 뒤로 가기 때문이다. 그냥 쌓으면 역 선택 화면에서 뒤로 눌렀을 때 이
   * 화면으로 왔다가 곧바로 다시 튕겨 나가 뒤로 가기가 통째로 막힌다.
   */
  /**
   * 지금 확인한 권한으로 진입해도 되는지.
   *
   * 저장된 기록만으로는 넘기지 않는다. 조회할 수 없는 브라우저에서 지난번 기록이 남아 있으면
   * 그 사이 권한을 껐어도 화면을 그냥 지나쳐 버린다. 그런 브라우저에서는 요청을 한 번 보내
   * 확인한 뒤에만 넘어간다 — 이미 허용돼 있으면 팝업 없이 즉시 끝난다.
   */
  const verified =
    canUseService && (phase === 'completed' || hasKnownPermissionState(browserStates));

  useEffect(() => {
    if (!verified) {
      return;
    }

    void navigate(USER_ROUTES.STATION, { replace: true });
  }, [verified, navigate]);

  /**
   * 권한이 갖춰지면 대화상자는 닫는다.
   *
   * 열려 있다는 사실을 상태에서 지우지 않고 화면에서만 감춘다. 화면을 옮기는 것은 위 효과인데
   * 그 사이 한 프레임 동안 "권한이 필요해요"가 남아 있으면, 방금 허용한 사용자에게 아직도
   * 부족하다고 말하는 꼴이 된다.
   */
  const reminder = verified ? 'none' : modal;
  const blockedKeys = blockedKinds.map((kind) => ROW_KEY_OF[kind]);

  /**
   * Runs the real browser prompts, location first and camera + microphone
   * after. Each row fills in as its answer arrives.
   *
   * The service is all-or-nothing: only with all three granted does the flow
   * continue to the station screen. Anything else keeps the user here.
   */
  const start = async () => {
    setModal('none');
    setHint('');

    const result = await requestPermissions();

    // 권한 설정을 바꿔도 풀리지 않는 실패들. 사용자가 할 일이 설정 화면 밖에 있다.
    const failure = result.camera.error?.name;

    if (failure === 'TimeoutError') {
      setHint(TIMEOUT_HINT);
    } else if (failure && DEVICE_BUSY_ERRORS.includes(failure)) {
      setHint(DEVICE_BUSY_HINT);
    }

    // Navigating or opening a dialog only makes sense while the user is still
    // on this screen — they may have gone back while a prompt was open.
    if (!isMountedRef.current) {
      return;
    }

    // 넘어가는 일은 위 효과가 맡는다. 여기서 함께 하면 설정 변경으로 갖춰진 경우를 놓친다.
    if (!result.canUseService) {
      setModal('incomplete');
    }
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
      {/*
        차단된 권한은 화면에 바로 적는다.

        대화상자에만 두면 볼 방법이 없다. 물어볼 것이 남지 않았을 때는 버튼이 잠기고, 대화상자는
        요청이 실패해야 열리기 때문이다. 그러면 사용자는 잠긴 버튼 앞에서 이유도 모른 채 멈춘다.
      */}
      {blockedKeys.length > 0 && (
        <p className={styles.hint} role="alert">
          {permissionNamesOf(blockedKeys)} 권한이 차단되어 있어요. 주소창의 자물쇠 아이콘을 눌러
          사이트 설정에서 허용으로 바꾸면 이 화면이 자동으로 넘어가요.
        </p>
      )}
      {/*
        차단 안내가 있으면 요청 실패 안내는 접는다.

        둘은 서로 다른 시점의 이야기다 — 차단은 지금 브라우저가 말하는 사실이고, 실패 안내는
        마지막 요청이 남긴 흔적이다. 나란히 두면 "차단됐다"와 "다른 앱이 쓰는 중이다"가 한
        화면에 같이 떠서, 사용자는 둘 중 무엇을 해야 하는지 알 수 없다. 지금 사실인 쪽을 남긴다.
      */}
      {blockedKeys.length === 0 && hint && (
        <p className={styles.hint} role="alert">
          {hint}
        </p>
      )}
      {/*
        물어볼 것이 하나도 남지 않았으면 버튼이 할 일이 없다. 눌러도 팝업이 뜨지 않고 곧바로
        대화상자만 다시 열리므로, 눌러야 할 곳이 브라우저 설정이라는 것을 버튼에서부터 알린다.
      */}
      <Button onClick={() => void start()} disabled={isRequesting || promptableKinds.length === 0}>
        {isRequesting
          ? '권한 요청 중…'
          : promptableKinds.length === 0
            ? '브라우저 설정에서 권한을 켜 주세요'
            : '권한 허용하고 시작하기'}
      </Button>

      {reminder !== 'none' && (
        <PermissionReminder
          variant={reminder}
          reason={hint || undefined}
          blockedKeys={blockedKeys}
          canPrompt={promptableKinds.length > 0}
          onDismiss={() => setModal('none')}
          onAllowAll={() => void start()}
        />
      )}
    </PhoneFrame>
  );
}
