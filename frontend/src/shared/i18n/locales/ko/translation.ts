export const ko = {
  translation: {
    app: { title: 'PinGo' },
    page: {
      home: '홈',
      user: '사용자',
      counselor: '상담원',
      admin: '관리자',
      notFound: '페이지를 찾을 수 없습니다',
    },
    home: {
      eyebrow: '지하철 실내 내비게이션',
      headline: '복잡한 역 안에서도 출구까지 안내해요',
      lede: 'GPS가 닿지 않는 지하에서 카메라로 현재 위치를 찾고,\n목적지까지 한 걸음씩 안내합니다.',
      enterTitle: '어떤 화면으로 들어갈까요?',
      enter: '들어가기',
      role: {
        user: '역 안에서 길을 찾고 상담을 요청해요',
        counselor: '상담 요청을 받고 화면을 함께 보며 안내해요',
        admin: '역·시설·경로와 상담자 계정을 관리해요',
      },
      feature: {
        locate: { title: '카메라로 위치 인식', desc: '주변을 한 바퀴 담으면 현재 위치를 찾아요' },
        route: { title: '실내 경로 안내', desc: '층과 출구까지 단계별로 알려줘요' },
        consult: { title: '실시간 상담', desc: '화면을 공유하고 번역과 함께 안내받아요' },
      },
    },
    indoorMap: {
      loading: '지도를 불러오는 중입니다',
      error: '지도를 불러오지 못했습니다',
      empty: '등록된 지도가 없습니다',
      floorNotFound: '해당 층의 지도가 없습니다',
      imageAlt: '{{floorCode}} 실내 지도',
    },
  },
} as const;
