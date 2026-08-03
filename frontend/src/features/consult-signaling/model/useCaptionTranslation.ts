import { useEffect, useState } from 'react';
import { translateConsultationCaption } from '@/shared/api';

/**
 * 상대가 말한 자막을 내 언어로 옮겨 보여 준다.
 *
 * 확정된 문장만 옮긴다. 말하는 도중의 중간 결과는 계속 고쳐 쓰이므로, 그때마다 옮기면 번역
 * 요청이 초당 몇 번씩 나가고 화면의 글자도 쉴 새 없이 바뀌어 읽을 수 없다.
 *
 * 옮기지 못하면 원문을 그대로 둔다. 번역 하나가 실패했다고 자막까지 사라지면, 상대가 무슨
 * 말을 했는지조차 알 수 없게 된다.
 */
export function useCaptionTranslation(
  consultationId: string | null,
  text: string,
  targetLanguage: string,
) {
  /**
   * 옮긴 결과를 어느 원문에서 얻었는지 함께 들고 있는다.
   *
   * 원문이 바뀌는 순간 지난 번역은 더 이상 그 말이 아니다. 따로 지우지 않고 짝이 맞는지만
   * 보면, 지나간 문장의 번역이 새 원문 자리에 남아 있는 일이 생기지 않는다.
   */
  const [result, setResult] = useState<{ source: string; text: string } | null>(null);
  const source = text.trim();

  useEffect(() => {
    if (!source || !consultationId) return;

    let cancelled = false;

    void translateConsultationCaption(consultationId, { text: source, targetLanguage })
      .then((response) => {
        if (!cancelled) setResult({ source, text: response.text || source });
      })
      .catch(() => {
        // 옮기지 못했으면 원문이라도 보여 준다.
        if (!cancelled) setResult({ source, text: source });
      });

    return () => {
      cancelled = true;
    };
  }, [consultationId, source, targetLanguage]);

  return result?.source === source ? result.text : '';
}
