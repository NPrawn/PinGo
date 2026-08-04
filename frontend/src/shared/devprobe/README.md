# 실기기 검사 패널 (임시 — S15P11A206-89)

모바일 실기기에서 WebRTC 화면 공유가 붙지 않는 원인을 찾기 위한 **일회용 도구**다. 확인이
끝나면 지운다.

## 왜 필요한가

모바일에는 콘솔이 없다. 그런데 원인을 가리는 값은 모두 화면에 적히지 않는 것들이다.

| 값                  | 어디에 있었나                | 왜 못 봤나                                  |
| ------------------- | ---------------------------- | ------------------------------------------- |
| `status`            | `useConsultSignaling` 지역값 | 사용자 화면의 `연결 상태:` 줄이 자막에 가림 |
| `eventChannelOpen`  | 같음                         | 같음                                        |
| `cameraStreamState` | `xrSessionController`        | 연결이 붙은 뒤에만 칩에 적힘                |
| 삼켜진 예외         | `console`                    | 모바일에 콘솔이 없다                        |

`cameraStreamState` 는 피어 연결과 무관하다 — XR 세션과 `camera-access` 만 있으면
`streaming` 이 된다. 연결이 안 붙는 동안에도 카메라 경로(A)는 이 패널로 확인할 수 있다.

## 어떻게 독립적인가

- 자기 스토어(`devProbeStore`)만 읽고 쓴다. 실 서비스 스토어에 값을 넣지 않는다.
- 자기 CSS 모듈만 쓴다. 디자인 토큰도 참조하지 않아 스타일이 새어 나가지 않는다.
- 자리를 스스로 만든다 — `position: fixed` + 최상위 `z-index`. 실 서비스 화면의 어떤
  클래스도 고치지 않았다.
- 화면에서 받는 값은 **읽기만** 한다. 이 패널을 지워도 화면 동작이 달라지지 않는다.
- 오류는 `window` 이벤트를 **듣기만** 한다. 원래 오류 처리에 끼어들지 않는다.

`import.meta.env.DEV` 로 감싸지 않았다. 배포 빌드로 실기기에 접속해 확인해야 하기 때문이다.
**그래서 반드시 지워야 한다.**

## 쓰는 법

오른쪽 아래 모서리의 `검사` 손잡이를 누르면 펼쳐진다. `복사` 를 누르면 값과 로그가 클립보드로
들어가므로 그대로 붙여 공유할 수 있다.

## 지우는 법

1. 이 폴더(`frontend/src/shared/devprobe/`)를 지운다.
2. 아래 두 화면에서 `DevProbe` 관련 줄을 지운다. 각 화면에서 세 곳뿐이다 — `import` 한 줄,
   `useDevProbe({...})` 호출, `<DevProbe />` JSX.
   - `frontend/src/pages/user/ui/ConsultSessionPage/ConsultSessionPage.tsx`
   - `frontend/src/pages/counselor/ui/SessionPage/SessionPage.tsx`
3. 사용자 화면의 `@/shared/api` import 에서 `getIceServers` 를 지운다(검사 버튼에만 쓴다).

찾기: `rg -n "devprobe|DevProbe" frontend/src` 가 비면 다 지운 것이다.
