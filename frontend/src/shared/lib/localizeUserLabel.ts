const ENGLISH_LABELS: Readonly<Record<string, string>> = {
  역삼역: 'Yeoksam Station',
  언주역: 'Eonju Station',
  강남역: 'Gangnam Station',
  신논현역: 'Sinnonhyeon Station',
  선릉역: 'Seolleung Station',
  선정릉역: 'Seonjeongneung Station',
  한티역: 'Hanti Station',
  학동역: 'Hak-dong Station',
  논현역: 'Nonhyeon Station',
  매봉역: 'Maebong Station',
  'GS25 역삼역점': 'GS25 Yeoksam Station',
  강남파이낸스센터: 'Gangnam Finance Center',
  '올리브영 역삼중앙점': 'Olive Young Yeoksam Jungang',
  '차지 역삼점': 'Chaji Yeoksam',
  '스타벅스 아크플레이스점': 'Starbucks Arc Place',
  '블리스 라운드 역삼점': 'Bliss Lounge Yeoksam',
};

/** Translates backend/demo labels that do not yet provide a separate English field. */
export function localizeUserLabel(label: string, language: string): string {
  if (language !== 'en') {
    const korean = Object.entries(ENGLISH_LABELS).find(([, english]) => english === label)?.[0];
    return korean ?? label;
  }

  const exact = ENGLISH_LABELS[label];
  if (exact) return exact;

  if (label === '출입구' || label === '출구') return 'Exit';
  if (label === '목적지') return 'Destination';

  const bottomOfStairs = /^(B\d+) 계단 하단$/.exec(label);
  if (bottomOfStairs) return `${bottomOfStairs[1]} Bottom of stairs`;

  const frontOfGate = /^(B\d+) 개찰구 앞$/.exec(label);
  if (frontOfGate) return `${frontOfGate[1]} In front of fare gates`;

  const testOrigin = /^(B\d+) 테스트 출발지$/.exec(label);
  if (testOrigin) return `${testOrigin[1]} Test Origin`;

  const numberedExit = /^(\d+)번 (?:출구|출입구)$/.exec(label);
  if (numberedExit) return `Exit ${numberedExit[1]}`;

  const verticalFacility = label
    .replace(/에스컬레이터/g, 'Escalator')
    .replace(/엘리베이터/g, 'Elevator')
    .replace(/계단/g, 'Stairs')
    .replace(/출발점/g, 'Start')
    .replace(/도착점/g, 'End')
    .replace(/→/g, ' to ');
  if (verticalFacility !== label) return verticalFacility.replace(/\s+/g, ' ').trim();

  return label;
}
