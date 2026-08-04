import { carriesDistance, instructionAt } from './stepInstruction';

describe('instructionAt', () => {
  it('거리 자리에 남은 거리를 채운다', () => {
    const step = { instruction: '197m 직진하세요.', instructionTemplate: '{distance} 직진하세요.' };

    expect(instructionAt(step, 197.48)).toBe('197m 직진하세요.');
    expect(instructionAt(step, 165)).toBe('165m 직진하세요.');
    expect(instructionAt(step, 0.4)).toBe('0m 직진하세요.');
  });

  /**
   * 숫자를 문장 앞에 붙이는 방법으로는 안 된다는 것을 붙잡는다. 영어는 거리가 문장 중간에 온다.
   */
  it('영어처럼 거리가 문장 중간에 오는 언어도 채운다', () => {
    const step = {
      instruction: 'Go straight for 197m.',
      instructionTemplate: 'Go straight for {distance}.',
    };

    expect(instructionAt(step, 42)).toBe('Go straight for 42m.');
  });

  it('회전 문장도 채운다', () => {
    const step = {
      instruction: '오른쪽으로 돌아 5m 이동하세요.',
      instructionTemplate: '오른쪽으로 돌아 {distance} 이동하세요.',
    };

    expect(instructionAt(step, 3)).toBe('오른쪽으로 돌아 3m 이동하세요.');
  });

  /** 층 이동 문장에는 거리가 없다. 채울 자리가 없으니 그대로 나온다. */
  it('거리가 없는 문장은 그대로 둔다', () => {
    const step = {
      instruction: '계단으로 한 층 올라가세요.',
      instructionTemplate: '계단으로 한 층 올라가세요.',
    };

    expect(instructionAt(step, 12)).toBe('계단으로 한 층 올라가세요.');
  });

  /**
   * 서버가 아직 템플릿을 주지 않는 경우. 배포 시점이 어긋날 수 있어 문장이 사라지지는 않아야
   * 한다 — 거리가 갱신되지 않을 뿐이다.
   */
  it('템플릿이 없으면 완성 문장을 그대로 쓴다', () => {
    expect(instructionAt({ instruction: '197m 직진하세요.' }, 42)).toBe('197m 직진하세요.');
  });

  it('문장이 아예 없으면 이동 수단으로 대신한다', () => {
    expect(instructionAt({ moveType: 'walkway' }, 42)).toBe('walkway');
    expect(instructionAt({}, 42)).toBe('이동');
  });
});

describe('carriesDistance', () => {
  it('문장이 거리를 품으면 참이다', () => {
    expect(carriesDistance({ instructionTemplate: '{distance} 직진하세요.' })).toBe(true);
    expect(carriesDistance({ instructionTemplate: 'Go straight for {distance}.' })).toBe(true);
  });

  it('층 이동·개찰구 문장은 거짓이다', () => {
    expect(carriesDistance({ instructionTemplate: '계단으로 한 층 올라가세요.' })).toBe(false);
    expect(carriesDistance({ instructionTemplate: '개찰구를 통과하세요.' })).toBe(false);
  });

  /** 템플릿이 없으면 거리를 채울 수 없으므로 따로 적어야 한다. */
  it('템플릿이 없으면 거짓이다', () => {
    expect(carriesDistance({ instruction: '197m 직진하세요.' })).toBe(false);
    expect(carriesDistance({})).toBe(false);
  });
});
