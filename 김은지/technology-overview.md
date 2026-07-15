
## 1. 맵 구축

실제 실내 공간을 촬영하고, 사용자의 현재 위치를 찾기 위한 **Visual Map**을 만드는 영역이다.

### 전체 흐름

```text
실제 공간 촬영
    ↓
FFmpeg
영상 → 이미지 프레임
    ↓
SuperPoint
이미지 특징점 추출
    ↓
LightGlue
이미지 간 동일 특징점 매칭
    ↓
COLMAP / PyCOLMAP
3D Visual Map 구축
```

---

### FFmpeg

**역할:** 촬영한 동영상을 이미지 프레임으로 변환

스마트폰으로 촬영한 실내 영상을 일정 간격의 이미지로 분할한다.

```text
corridor.mp4
    ↓ FFmpeg
frame_00001.jpg
frame_00002.jpg
frame_00003.jpg
...
```

**프로젝트 적용**

* 지하철역 내부를 스마트폰으로 동영상 촬영
* 촬영 영상을 이미지 데이터셋으로 변환
* 생성된 이미지를 Visual Map 구축에 사용

---

### SuperPoint

**역할:** 이미지 특징점 추출

이미지에서 다른 사진과 비교하기 좋은 특징적인 지점을 찾는다.

예:

* 문 모서리
* 천장 조명
* 표지판 모서리
* 기둥
* 벽의 특정 무늬

```text
이미지
    ↓ SuperPoint
특징점 + Descriptor
```

**프로젝트 적용**

사전에 촬영한 공간 이미지와 사용자의 현재 카메라 이미지에서 특징점을 추출한다.

---

### LightGlue

**역할:** 서로 다른 이미지의 동일한 특징점 연결

```text
이미지 A                    이미지 B

문 모서리 ● ────────────── ● 문 모서리
소화기   ● ────────────── ● 소화기
천장 조명 ● ────────────── ● 천장 조명
```

**프로젝트 적용**

* Visual Map 구축 시 여러 촬영 이미지를 서로 연결
* 현재 사용자 이미지와 기존 기준 이미지 비교

---

### COLMAP

**역할:** 여러 이미지에서 3D 공간 구조와 카메라 위치 복원

여러 위치와 각도에서 촬영한 이미지의 특징점 대응관계를 이용해 다음을 계산한다.

* 공간의 3D 특징점
* 각 사진의 촬영 위치
* 각 사진을 찍은 카메라의 방향

```text
여러 이미지
    ↓
특징점 매칭
    ↓
COLMAP
    ↓
3D Points + Camera Poses
```

**프로젝트 적용**

직접 촬영한 지하철역 내부 이미지로 현재 위치 파악에 사용할 **Visual Map**을 구축한다.

---

### PyCOLMAP

**역할:** Python 코드에서 COLMAP 기능 사용

COLMAP의 기능을 Python 환경에서 다룰 수 있도록 한다.

**프로젝트 적용**

* Visual Map 구축 자동화
* 3D Map 데이터 처리
* 카메라 Pose 계산
* hloc과 연계

즉:

```text
COLMAP
= 3D reconstruction 핵심 엔진

PyCOLMAP
= Python에서 COLMAP 기능을 사용하는 인터페이스
```

---

### Visual Map

**역할:** 현재 위치를 찾기 위한 지도

사람이 보는 일반적인 지도와 다르다.

포함 정보:

* 기준 이미지
* 이미지별 특징점
* Descriptor
* 3D 특징점
* 각 이미지의 촬영 위치
* 각 카메라의 방향

```text
실제 공간 촬영
    ↓
SuperPoint
    ↓
LightGlue
    ↓
COLMAP
    ↓
Visual Map
```

**프로젝트 적용**

사용자의 현재 카메라 화면을 기존 Visual Map과 비교해서 현재 위치와 방향을 찾는다.

---

# 2. 현재 위치 추정

사용자가 카메라를 켰을 때, Visual Map 안에서 현재 어디에 있는지 찾는 영역이다.

### 전체 흐름

```text
사용자 현재 카메라 이미지
        ↓
hloc
비슷한 장소 후보 검색
        ↓
SuperPoint
특징점 추출
        ↓
LightGlue
기존 이미지와 특징점 매칭
        ↓
PyCOLMAP / Pose Estimation
현재 위치와 방향 계산
```

---

### hloc

**정식 명칭:** Hierarchical Localization

**역할:** 새로운 카메라 이미지가 기존 Visual Map의 어느 위치에서 촬영됐는지 추정

```text
현재 카메라 이미지
        ↓
비슷한 기존 이미지 검색
        ↓
특징점 정밀 매칭
        ↓
기존 3D Visual Map과 비교
        ↓
현재 위치 + 방향 계산
```

결과 예:

```text
Position
x = 12.3
y = 1.6
z = 25.8

Direction
yaw = 82°
```

**프로젝트 적용**

사용자가 지하철역 내부에서 카메라를 켰을 때:

* 현재 위치
* 현재 바라보는 방향

을 찾는 핵심 기술이다.

---

### 위치추정에서 각 기술의 관계

```text
hloc
전체 위치추정 파이프라인 관리
        │
        ├── SuperPoint
        │   현재 이미지 특징점 추출
        │
        ├── LightGlue
        │   기존 이미지와 특징점 매칭
        │
        └── PyCOLMAP
            카메라 위치·방향 계산
```

즉 `hloc`, `SuperPoint`, `LightGlue`, `PyCOLMAP`은 별개의 기능을 따로 사용하는 것이 아니라 **하나의 Visual Localization 파이프라인 안에서 함께 사용된다.**

---

# 3. 이동 중 위치 추적 및 오차 보정

Visual Localization을 모든 카메라 프레임마다 실행하는 것은 연산 비용이 크다.

따라서:

```text
Visual Localization
현재 절대 위치 확인
        ↓
사용자 이동
        ↓
ARCore / WebXR / VIO
상대 이동 추적
        ↓
오차 증가
        ↓
Visual Localization 재실행
        ↓
위치 보정
```

구조를 사용한다.

---

### ARCore

**역할:** Android 스마트폰의 카메라와 센서를 이용해 기기의 상대 위치와 방향 추적

예:

```text
최초 위치
(0, 0, 0)

    ↓ 2m 전진

(0, 0, 2)

    ↓ 오른쪽으로 회전

회전 90°
```

**프로젝트 적용**

Visual Localization으로 현재 절대 위치를 한 번 찾은 이후, 사용자가 얼마나 이동했는지 추적한다.

```text
Visual Localization
"지금 정확히 여기"

        ↓

ARCore
"그 이후 3m 이동"

        ↓

Visual Localization 재실행
"실제 위치 다시 확인"
```

---

### WebXR

**역할:** 웹 브라우저에서 XR/AR 관련 기능 사용

**프로젝트 적용**

웹 서비스 형태를 유지하면서:

* 기기 위치 추적
* 공간 좌표 활용
* 추후 AR 안내

등에 사용할 수 있다.

단, 브라우저와 운영체제별 지원 차이를 검증해야 한다.

---

### VIO

**정식 명칭:** Visual-Inertial Odometry

**역할:** 카메라 영상과 관성 센서를 함께 이용해 이동 추정

사용 정보:

```text
Camera
+
Accelerometer
+
Gyroscope
        ↓
이동량 + 방향 변화 추정
```

**프로젝트 적용**

Visual Localization 사이 구간에서 사용자의 상대 이동을 추적한다.

---

### IMU

**정식 명칭:** Inertial Measurement Unit

주요 센서:

* Accelerometer
* Gyroscope
* Magnetometer

**프로젝트 적용**

* 이동 방향 보조
* 회전 감지
* 걸음 및 움직임 감지

단독으로 장시간 위치를 계산하면 오차가 계속 누적되기 때문에 Visual Localization과 함께 사용하는 것이 적합하다.

---

### 이동 추적 기술 관계

```text
Visual Localization
절대 위치 확인
        ↓
ARCore / WebXR / VIO
상대 이동 추적
        ↓
IMU
움직임·회전 보조
        ↓
Visual Localization 재실행
절대 위치 재보정
```

---

# 4. 길찾기

현재 위치를 길찾기용 지도 위에 올리고 목적지까지 경로를 계산하는 영역이다.

### 전체 흐름

```text
현재 위치
    ↓
Navigation Map
    ↓
Map Matching
    ↓
A* / Dijkstra
    ↓
목적지까지 경로
```

---

### Navigation Map

**역할:** 실제 길찾기를 위한 지도

지하철역 내부의 장소를 Node, 이동 가능한 통로를 Edge로 표현한다.

```text
플랫폼 ── 개찰구 ── 갈림길 ── 출구
                         │
                      화장실
                         │
                     엘리베이터
```

저장 정보 예:

* 출구
* 승강장
* 개찰구
* 화장실
* 계단
* 엘리베이터
* 거리
* 층
* 휠체어 이동 가능 여부

**프로젝트 적용**

* 일반 최단경로
* 엘리베이터 우선 경로
* 계단 제외 경로
* 접근성 경로

의 기반 데이터로 사용한다.

---

### Map Matching

**역할:** 위치추정 결과를 실제 이동 가능한 통로 위로 보정

예:

```text
Visual Localization 결과
        ●
        │
        ↓

A ──────●──────── B
       실제 통로
```

**프로젝트 적용**

위치추정 오차 때문에 사용자가:

* 벽 안
* 상점 내부
* 이동 불가능한 영역

에 있는 것처럼 표시되는 문제를 줄인다.

---

### A* Algorithm

**역할:** 현재 위치에서 목적지까지 최적 경로 탐색

```text
현재 위치
    ↓
갈림길
    ↓
엘리베이터
    ↓
개찰구
    ↓
3번 출구
```

**프로젝트 적용**

* 최단경로
* 계단 제외 경로
* 엘리베이터 우선 경로

등을 계산한다.

현재 프로젝트에서는 우선적으로 A*를 고려한다.

---

### Dijkstra Algorithm

**역할:** 그래프 기반 최단경로 탐색

Navigation Map의 Node와 Edge를 이용해 목적지까지 최단경로를 계산한다.

실내 지도 규모가 크지 않다면 A*와 Dijkstra 모두 사용 가능하다.

---

# 5. 역무원 실시간 연결

사용자가 자동 길찾기로 해결하기 어렵거나 직접 도움을 요청했을 때 역무원과 연결하는 영역이다.

### 전체 흐름

```text
사용자 도움 요청
        ↓
WebRTC 연결
        ↓
사용자 카메라 + 마이크
        ↓
역무원 웹 대시보드

동시에

현재 위치
목적지
추천 경로
        ↓
역무원 화면에 표시
```

---

### WebRTC

**역할:** 사용자와 역무원 간 실시간 영상·음성 통신

```text
사용자 스마트폰 카메라
        ↓
      WebRTC
        ↓
역무원 웹 대시보드
```

**프로젝트 적용**

역무원이 사용자가 실제로 보고 있는 화면을 실시간으로 확인하면서 안내한다.

---

### RTCPeerConnection

**역할:** WebRTC의 영상·음성 연결 관리

전송 대상:

* 사용자 카메라 영상
* 사용자 마이크
* 역무원 음성

---

### RTCDataChannel

**역할:** 영상 외 일반 데이터를 실시간 전달

전송 정보 예:

```text
현재 위치
현재 방향
목적지
추천 경로
위치추정 신뢰도
```

**프로젝트 적용**

역무원이 사용자 영상뿐 아니라 현재 위치와 이동 경로를 함께 확인할 수 있도록 한다.

---

# 6. 웹, 서버, 데이터 관리

전체 기능을 실제 서비스로 연결하는 영역이다.

### 전체 구조

```text
사용자 모바일 웹
Vue 3 + TypeScript
        ↓
FastAPI
위치추정 API
        ↓
hloc / PyCOLMAP
        ↓
현재 위치 반환

동시에

Navigation Map / PostgreSQL
길찾기 데이터 관리
```

---

### Vue 3

**언어:** JavaScript / TypeScript

**역할:** 사용자 및 역무원 웹 화면 개발

사용자 화면:

* 카메라 실행
* 목적지 검색
* 현재 위치 표시
* 길 안내
* 역무원 도움 요청

역무원 화면:

* 사용자 실시간 영상
* 현재 위치
* 목적지
* 추천 경로

---

### TypeScript

**역할:** 프론트엔드 애플리케이션 로직 개발

사용 예:

* 카메라 제어
* API 요청
* 위치 데이터 처리
* Navigation Map 표시
* WebRTC 연결 관리

---

### FastAPI

**언어:** Python

**역할:** 위치추정 기능을 웹 API로 제공

예:

```text
POST /api/localize
```

입력:

```text
현재 카메라 이미지
```

출력:

```json
{
  "x": 12.3,
  "y": 1.6,
  "z": 25.8,
  "yaw": 82
}
```

**프로젝트 적용**

프론트엔드에서 전송된 카메라 이미지를 받아 hloc 기반 위치추정을 실행하고 결과를 반환한다.

---

### PostgreSQL

**역할:** 서비스 데이터 저장

저장 대상 예:

* 역 정보
* 층 정보
* Node
* Edge
* 출구
* 화장실
* 엘리베이터
* 접근성 정보
* 사용자 세션

초기 기술검증에서는 JSON 파일로 시작하고, 실제 서비스 구조로 확장할 때 PostgreSQL을 사용할 수 있다.

---

# 기능별 핵심 기술 요약

| 기능 영역    | 핵심 기술                | 역할                  |
| -------- | -------------------- | ------------------- |
| 맵 구축     | FFmpeg               | 영상 → 이미지 변환         |
| 맵 구축     | SuperPoint           | 이미지 특징점 추출          |
| 맵 구축     | LightGlue            | 이미지 간 특징점 매칭        |
| 맵 구축     | COLMAP / PyCOLMAP    | 3D Visual Map 구축    |
| 현재 위치 추정 | hloc                 | 새 카메라 이미지의 위치·방향 추정 |
| 이동 추적    | ARCore / WebXR / VIO | 이동 중 상대 위치 추적       |
| 보조 센서    | IMU                  | 움직임·회전 보조           |
| 길찾기      | Navigation Map       | 이동 가능한 실내 경로 표현     |
| 길찾기      | Map Matching         | 위치를 실제 통로 위로 보정     |
| 길찾기      | A* / Dijkstra        | 목적지까지 경로 계산         |
| 실시간 지원   | WebRTC               | 사용자와 역무원 영상·음성 통신   |
| 실시간 지원   | RTCDataChannel       | 위치·경로 정보 전달         |
| AI 서버    | FastAPI              | 위치추정 API 제공         |
| 프론트엔드    | Vue 3 / TypeScript   | 사용자·역무원 웹 화면        |
| 데이터 관리   | PostgreSQL / JSON    | 역·시설·경로 정보 저장       |

# 전체 기술 구조 한눈에 보기

```text
[1. 맵 구축]

스마트폰 영상
    ↓
FFmpeg
    ↓
SuperPoint
    ↓
LightGlue
    ↓
COLMAP / PyCOLMAP
    ↓
Visual Map


[2. 현재 위치 추정]

사용자 카메라
    ↓
hloc
    ↓
현재 위치 + 방향


[3. 이동 추적]

현재 절대 위치
    ↓
ARCore / WebXR / VIO
    ↓
상대 이동 추적
    ↓
Visual Localization 재실행
    ↓
오차 보정


[4. 길찾기]

현재 위치
    ↓
Navigation Map
    ↓
Map Matching
    ↓
A*
    ↓
목적지까지 경로


[5. 도움 요청]

사용자 카메라 + 마이크
    ↓
WebRTC
    ↓
역무원

현재 위치 + 목적지 + 추천 경로
    ↓
RTCDataChannel
    ↓
역무원


[6. 서비스 구현]

Vue 3 / TypeScript
    ↓
FastAPI
    ↓
hloc / PyCOLMAP

Navigation Data
    ↓
JSON / PostgreSQL
```
