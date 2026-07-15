맞아. **우리가 지금까지 “VPS로 맵을 구축한다”라고 말했지만, 그 표현 자체가 너무 추상적이었어.**
실제로는 **VPS라는 프로그램 하나를 실행해서 맵 생성 버튼을 누르는 게 아니야.**

우리 자체 구축안에서는 대략 이런 식이야.

> **스마트폰으로 실제 공간을 동영상 촬영 → MP4 파일을 PC로 가져옴 → FFmpeg로 수백 장의 JPG 이미지로 분해 → VS Code/Colab에서 Python 기반 hloc 코드를 실행 → SuperPoint·LightGlue·COLMAP이 이미지들을 분석 → 3D 특징 지도 파일 생성 → 나중에 새로운 카메라 사진을 넣어서 그 지도 안의 현재 위치를 계산**

이걸 진짜 실제 작업 화면 기준으로 설명해볼게.

---

# 1. 우리가 실제로 처음 하는 일: 그냥 스마트폰으로 동영상을 찍는다

예를 들어 SSAFY 복도를 테스트한다고 하자.

팀원이 스마트폰 기본 카메라 앱을 켜고 천천히 걸어가면서 촬영해.

```text
📱 스마트폰

복도 입구
   ↓ 걸으면서 촬영
강의실 앞
   ↓
갈림길
   ↓
엘리베이터
```

촬영이 끝나면 그냥 이런 평범한 파일 하나가 생겨.

```text
ssafy_corridor.mp4
```

**일단은 정말 MP4 동영상으로 저장만 하면 돼.**

별도의 VPS 전용 촬영 앱이 꼭 필요한 건 아니야.

다만 COLMAP 공식 가이드에서도 같은 장소가 여러 이미지에 충분히 겹쳐 보여야 하고, 카메라를 한 자리에서 회전시키기만 하지 말고 실제로 위치를 움직이며 여러 시점에서 촬영할 것을 권장해. 동영상을 쓴다면 프레임을 적절히 다운샘플링하는 것도 권장한다. ([Colmap][1])

그래서 촬영은 이런 식이 좋아.

```text
잘못된 촬영 ❌

한 자리에서 서서
왼쪽 → 정면 → 오른쪽만 회전


좋은 촬영 ⭕

2m 이동
→ 앞쪽 촬영
→ 조금 이동
→ 좌우 공간도 촬영
→ 또 이동
→ 갈림길 여러 방향 촬영
```

---

# 2. 촬영한 MP4 파일을 PC로 가져온다

예를 들면 프로젝트 폴더를 이렇게 만들어.

```text
indoor-vps/
│
├── videos/
│   └── ssafy_corridor.mp4
│
├── images/
│
├── queries/
│
├── outputs/
│
└── scripts/
```

VS Code에서 이 폴더를 열면 이런 모습이지.

```text
📁 indoor-vps
 ┣ 📁 videos
 ┃ ┗ 🎞 ssafy_corridor.mp4
 ┣ 📁 images
 ┣ 📁 queries
 ┣ 📁 outputs
 ┗ 📁 scripts
```

**여기까지는 그냥 일반 개발 프로젝트랑 똑같아.**

---

# 3. 동영상을 누가 데이터화하느냐? → FFmpeg가 이미지로 쪼갠다

여기서 `ssafy_corridor.mp4`를 그대로 hloc에 넣는 게 아니야.

우선 동영상을 이미지 여러 장으로 분리해.

예를 들면 VS Code 터미널에서:

```bash
ffmpeg -i videos/ssafy_corridor.mp4 -vf fps=2 images/frame_%05d.jpg
```

이렇게 실행한다고 하자.

그러면:

```text
ssafy_corridor.mp4

        ↓ FFmpeg

frame_00001.jpg
frame_00002.jpg
frame_00003.jpg
frame_00004.jpg
...
frame_00500.jpg
```

가 생겨.

실제 폴더:

```text
indoor-vps/
│
├── videos/
│   └── ssafy_corridor.mp4
│
├── images/
│   ├── frame_00001.jpg
│   ├── frame_00002.jpg
│   ├── frame_00003.jpg
│   ├── frame_00004.jpg
│   └── ...
```

**이 순간부터 동영상은 VPS 지도 구축을 위한 이미지 데이터셋이 되는 거야.**

아직 AI 분석은 안 한 상태고, 단순히 영상에서 JPG 이미지들을 추출한 거야.

---

# 4. 그다음에는 어디서 작업하느냐?

여기에는 세 가지 방법이 있어.

### 방법 A. VS Code + 터미널

```text
Windows / WSL2 / Ubuntu
        ↓
VS Code
        ↓
Python 가상환경
        ↓
hloc 설치
        ↓
Python 코드 또는 CLI 실행
```

### 방법 B. Jupyter Notebook

셀을 하나씩 실행하면서 결과 확인.

```text
[Cell 1] 이미지 불러오기
[Cell 2] 특징 추출
[Cell 3] 특징 매칭
[Cell 4] 3D 지도 생성
[Cell 5] 결과 시각화
```

### 방법 C. Google Colab

브라우저에서 GPU 환경을 이용해서 먼저 테스트.

**우리 팀이 처음 기술검증을 한다면 나는 Colab이나 Jupyter Notebook부터 추천해.**

왜냐하면 hloc 공식 저장소 자체가 `demo.ipynb`와 `pipeline_SfM.ipynb`를 제공하고, 브라우저의 Google Colab에서도 자신의 데이터로 SfM 및 localization을 수행할 수 있다고 안내하고 있어. hloc은 Python 기반 스크립트나 CLI 방식으로도 실행 가능해. ([GitHub][2])

즉 실제 화면은 이런 느낌이야.

```text
┌──────────────────────────────────────┐
│ Google Colab / Jupyter Notebook      │
├──────────────────────────────────────┤
│                                      │
│ [1] 데이터 경로 설정                  │
│                                      │
│ images = Path("./images")            │
│                                      │
│          ▶ 실행                       │
├──────────────────────────────────────┤
│ [2] SuperPoint 특징 추출              │
│                                      │
│          ▶ 실행                       │
├──────────────────────────────────────┤
│ [3] LightGlue 특징 매칭               │
│                                      │
│          ▶ 실행                       │
├──────────────────────────────────────┤
│ [4] SfM Map 생성                      │
│                                      │
│          ▶ 실행                       │
└──────────────────────────────────────┘
```

그러니까 **“VPS 맵을 어떤 툴에서 만드는가?”에 대한 답은 하나가 아니라**:

> **촬영은 스마트폰 → 프레임 추출은 FFmpeg → Visual Map 구축 코드는 Python/hloc → 내부적으로 PyCOLMAP/COLMAP 사용 → 결과 확인은 Notebook 또는 COLMAP GUI**

야.

---

# 5. 이제 hloc에 이미지 폴더를 넣는다

우리한테 지금 이 이미지들이 있지.

```text
images/
├── frame_00001.jpg
├── frame_00002.jpg
├── frame_00003.jpg
├── ...
└── frame_00500.jpg
```

hloc에 이 이미지 폴더를 입력으로 준다.

그러면 hloc 파이프라인이 대략 다음 작업을 수행해.

```text
500장의 JPG 이미지
        ↓
① 이미지마다 특징점 추출
        ↓
② 어떤 이미지끼리 같은 장소인지 찾기
        ↓
③ 같은 물체의 특징점을 연결
        ↓
④ 여러 이미지의 카메라 위치 계산
        ↓
⑤ 공간의 3D 특징점 생성
        ↓
Visual Map 완성
```

hloc 공식 파이프라인도 실제로 `local feature 추출 → reference 3D SfM model 구축 → 관련 이미지 검색 → query matching → localization` 순서로 구성돼 있다. ([GitHub][2])

---

# 6. SuperPoint가 실제로 하는 일

사진 하나가 있다고 해보자.

```text
┌────────────────────────────┐
│       □ 천장 조명           │
│                            │
│          🚪 강의실 문        │
│                            │
│  🧯                        │
└────────────────────────────┘
```

SuperPoint를 돌리면 이런 특징점을 찾아.

```text
┌────────────────────────────┐
│    ●  ●   □    ●           │
│                            │
│       ●   ●🚪 ●            │
│                            │
│  ●🧯  ●                    │
└────────────────────────────┘
```

그 결과가 컴퓨터 데이터로 저장돼.

개념적으로는:

```text
frame_00001.jpg

keypoint 1: (x=123, y=82)
keypoint 2: (x=241, y=94)
keypoint 3: (x=331, y=217)
...
```

그리고 각 점에는 그 점을 다른 사진에서 다시 찾기 위한 descriptor가 붙어.

실제로 hloc은 추출된 특징을 HDF5 형태의 feature 파일로 저장할 수 있고, 각 이미지별로 `keypoints`, `descriptors` 등의 예측 데이터를 가진다. ([GitHub][2])

즉 프로젝트 폴더에 대략 이런 데이터가 생긴다고 생각하면 돼.

```text
outputs/
└── features.h5
```

---

# 7. LightGlue는 사진끼리 같은 점을 연결한다

예를 들어:

```text
frame_00001.jpg              frame_00002.jpg

천장 조명 ● ────────────────── ● 천장 조명

강의실 문 ● ────────────────── ● 강의실 문

소화기    ● ────────────────── ● 소화기
```

LightGlue가:

> "이 사진의 32번 특징점과 저 사진의 91번 특징점은 현실 세계의 같은 지점이다."

를 찾아내는 거야.

그 결과도 파일로 저장돼.

예:

```text
outputs/
├── features.h5
└── matches.h5
```

hloc 공식 문서상 match 파일은 이미지 쌍별 특징점 대응관계를 저장한다. ([GitHub][2])

---

# 8. COLMAP/PyCOLMAP은 그 결과를 가지고 실제 'Visual Map'을 만든다

여기서 이제 진짜 맵이 만들어져.

예를 들어 같은 소화기가 여러 사진에서 보였다고 하자.

```text
카메라 1 📷
       \
        \
         ● 소화기

         |
         |

카메라 2 📷


              📷 카메라 3
              /
             /
            ●
```

사진을 여러 위치에서 찍었기 때문에:

* 카메라 1은 어디에 있었는지
* 카메라 2는 어디에 있었는지
* 소화기는 3차원 공간 어디에 있는지

를 계산할 수 있어.

이게 **Structure-from-Motion(SfM)**이야.

COLMAP은 여러 시점에서 촬영한 중첩 이미지로부터 3D 구조와 입력 이미지들의 카메라 pose를 복원한다. ([Colmap][1])

결과적으로 이런 파일들이 생성돼.

```text
outputs/
├── features.h5
├── matches.h5
│
└── sfm/
    ├── cameras.bin
    ├── images.bin
    └── points3D.bin
```

각각 개념적으로:

```text
cameras.bin
→ 어떤 카메라 모델과 렌즈 정보를 사용했는가

images.bin
→ 각각의 기준 이미지를 어디에서 어떤 방향으로 촬영했는가

points3D.bin
→ 공간에서 검출된 3D 특징점은 어디에 있는가
```

COLMAP의 실제 reconstruction 결과도 `cameras.bin`, `images.bin`, `points3D.bin` 등의 형태로 저장된다. COLMAP은 GUI와 CLI 양쪽 모두 제공하며, 이미지 폴더를 입력으로 받아 reconstruction 결과를 workspace에 생성할 수 있다. ([Colmap][1])

---

# 9. 그래서 완성된 Visual Map이 뭐냐?

아까 우리는 처음에 이것밖에 없었어.

```text
ssafy_corridor.mp4
```

그런데 처리 후에는:

```text
영상
 ↓
JPG 500장
 ↓
특징 데이터
 ↓
이미지 간 매칭 데이터
 ↓
카메라 위치 데이터
 ↓
3D 특징점 데이터
```

가 되는 거야.

폴더로 표현하면:

```text
indoor-vps/
│
├── videos/
│   └── ssafy_corridor.mp4
│
├── images/
│   ├── frame_00001.jpg
│   ├── frame_00002.jpg
│   └── ...
│
└── outputs/
    ├── features.h5
    ├── matches.h5
    │
    └── sfm/
        ├── cameras.bin
        ├── images.bin
        └── points3D.bin
```

**이 데이터 전체가 우리가 말하던 Visual Map이라고 보면 돼.**

예쁜 지도가 아니야.

컴퓨터가:

> "아, 저 천장 모서리는 3D 좌표 `(3.2, 1.8, 7.4)`에 있고, 이 문은 이쪽에 있고, frame_0125는 여기서 저 방향을 보고 찍은 사진이구나."

라고 이해하기 위한 데이터야.

---

# 10. 그런데 실제로 눈으로 볼 수도 있어

여기서 COLMAP GUI를 사용할 수 있어.

즉 꼭 VS Code의 텍스트 파일만 보는 건 아니야.

대략 이런 느낌의 3D 결과를 확인하게 돼.

```text
                  ● ● ●
             ● ●       ● ●

       📷
            ● ● ● ●
                  📷

      ●          ●        ●

                         📷
```

* 점들: 공간의 3D 특징점
* 카메라 모양: 기준 이미지를 촬영했던 위치와 방향

COLMAP은 실제로 Windows용 GUI도 제공하고, `Reconstruction > Automatic Reconstruction` 방식으로 이미지 폴더와 작업 폴더를 지정해서 reconstruction을 실행할 수도 있다. CLI로 동일한 과정을 실행하는 것도 가능하다. ([Colmap][1])

그래서 **첫 기술검증만 한다면 hloc을 바로 붙이기 전에 COLMAP GUI에 이미지 100~300장 넣고 3D reconstruction이 되는지 눈으로 먼저 확인하는 것도 꽤 좋은 접근**이야.

---

# 11. 이제 새로운 사용자가 등장한다

Visual Map은 이미 만들어뒀어.

```text
📁 Visual Map
- 기준 이미지 500장
- 특징 데이터
- 이미지 매칭 데이터
- 3D 포인트
- 카메라 pose
```

이번에는 전혀 다른 날에 사용자가 복도 중간에 서서 새로운 사진을 찍어.

```text
query.jpg
```

중요한 건 이 사진은 **지도 구축에 사용하지 않은 새로운 사진**이야.

프로젝트 폴더:

```text
queries/
└── query.jpg
```

이제 이 한 장을 hloc에 넣어.

---

# 12. 현재 위치 찾기는 실제로 이렇게 진행된다

```text
query.jpg
    ↓
SuperPoint
현재 사진의 특징점 추출
    ↓
기존 Visual Map의 이미지 중
비슷한 장소 후보 검색
    ↓
LightGlue
정밀 특징점 매칭
    ↓
기존 3D Point와 연결
    ↓
PyCOLMAP
Camera Pose 계산
```

예를 들어:

```text
현재 query.jpg

천장 모서리 ● ──────→ 기존 3D Point 271
강의실 문   ● ──────→ 기존 3D Point 813
소화기      ● ──────→ 기존 3D Point 1422
```

충분한 대응점이 있으면:

```text
현재 카메라 위치:
x = 12.31
y = 1.64
z = 25.82

현재 카메라 방향:
yaw = 81.7°
```

가 나오는 거야.

**이게 우리가 말하는 현재 위치 파악이야.**

hloc은 바로 이런 용도의 6DoF visual localization 도구로, 자체 데이터셋을 이용해 3D SfM 모델을 만든 뒤 새로운 query image를 위치추정할 수 있다. ([GitHub][2])

---

# 13. 처음부터 실시간 웹 서비스로 개발하는 게 아니다

이 부분이 진짜 중요해.

나는 우리 팀이라면 절대 처음부터 이렇게 안 해.

```text
모바일 웹 카메라
→ 서버
→ hloc
→ 실시간 위치
→ 길찾기
```

처음에는 너무 복잡해.

## 1차 기술검증

그냥 PC에서:

```text
사전 촬영 영상
    ↓
프레임 추출
    ↓
Visual Map 구축
```

그리고 별도의 새 사진 한 장:

```text
test_query.jpg
    ↓
Visual Map에 입력
    ↓
위치가 제대로 나오는지 확인
```

**여기까지만 먼저 해.**

---

## 2차 기술검증

사진 여러 장으로 테스트.

```text
query_01.jpg
→ 실제 위치 A

query_02.jpg
→ 실제 위치 B

query_03.jpg
→ 실제 위치 C
```

정확도 측정.

```text
A: 실제 위치와 0.8m 오차
B: 1.2m 오차
C: 위치추정 실패
```

---

## 3차 개발

그때 FastAPI를 붙여.

```text
POST /api/localize
```

입력:

```text
현재 카메라 사진
```

출력:

```json
{
  "success": true,
  "x": 12.31,
  "y": 1.64,
  "z": 25.82,
  "yaw": 81.7
}
```

---

## 4차 개발

그제서야 모바일 웹 카메라와 연결.

```text
Vue 모바일 웹
    ↓
카메라 프레임 캡처
    ↓
FastAPI /localize
    ↓
hloc
    ↓
현재 위치 반환
    ↓
화면에 표시
```

---

# 14. 한마디로 실제 개발자는 무엇을 하느냐?

## 맵 구축 담당자는

```text
1. 스마트폰으로 MP4 촬영
2. PC로 영상 복사
3. FFmpeg 실행
4. JPG 이미지 추출
5. VS Code 또는 Colab에서 Python 환경 실행
6. hloc 코드 실행
7. SuperPoint 특징 추출
8. LightGlue 매칭
9. PyCOLMAP으로 SfM Map 생성
10. COLMAP GUI 등으로 결과 확인
```

## 위치추정 담당자는

```text
1. 새로운 query.jpg 준비
2. hloc localization 실행
3. 기존 Visual Map과 비교
4. x, y, z + rotation 결과 획득
5. 결과를 JSON으로 반환하도록 API 개발
```

## 프론트 담당자는

```text
1. 모바일 웹에서 카메라 실행
2. 현재 프레임 캡처
3. AI 서버에 이미지 전송
4. 받은 x, y, z 위치 표시
5. Navigation Map과 연결
6. 길 안내 UI 표시
```

---

# 내 솔직한 판단: 지금 너희가 제일 먼저 해봐야 하는 건 이것뿐이야

```text
┌───────────────────────────────────────────┐
│               DAY 1                       │
│                                           │
│ 스마트폰으로 복도 20~30m 영상 촬영          │
│                   ↓                       │
│ MP4 파일 확보                              │
│                   ↓                       │
│ FFmpeg로 JPG 수백 장 추출                   │
├───────────────────────────────────────────┤
│               DAY 2                       │
│                                           │
│ hloc / PyCOLMAP 환경 구축                  │
│                   ↓                       │
│ Visual Map 생성                            │
│                   ↓                       │
│ COLMAP 또는 3D 시각화로 결과 확인            │
├───────────────────────────────────────────┤
│               DAY 3                       │
│                                           │
│ 새로운 위치에서 테스트 사진 촬영             │
│                   ↓                       │
│ hloc localization 실행                    │
│                   ↓                       │
│ 실제로 현재 위치와 방향이 나오는지 검증        │
└───────────────────────────────────────────┘
```

**이게 되면 비로소 “우리 자체 VPS 구축이 가능하다”라고 말할 수 있다.**

그리고 지금 네가 원했던 **“어떤 프로그램 화면에서 뭘 하고, 어떤 파일이 생기고, 그 파일이 어디로 넘어가는지”**를 한눈에 보고 싶다면, 다음 단계는 추상적인 시스템 아키텍처가 아니라 **`스마트폰 → MP4 → FFmpeg → JPG → VS Code/Colab → hloc → HDF5 → PyCOLMAP → 3D Visual Map → query.jpg → 현재 위치 JSON`**이라는 **실제 개발 워크플로 다이어그램**을 그리는 게 맞아.

[1]: https://colmap.github.io/tutorial.html "Tutorial — COLMAP"
[2]: https://github.com/cvg/Hierarchical-Localization "GitHub - cvg/Hierarchical-Localization: Visual localization made easy with hloc · GitHub"
