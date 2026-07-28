import { USER_ROUTES } from '@/shared/config';
import { Blob, BlobHero, ButtonLink, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { LanguageSelect } from '@/features/language-select';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './LanguagePage.module.css';

/** Screen 02 (FR-U-001) — language selection. */
export function LanguagePage() {
  return (
    <PhoneFrame layout="hero">
      <LivePill>STATION FINDER</LivePill>

      <BlobHero className={styles.hero}>
        <Blob slot="main" />
        <Blob tone="coral" slot="a" style={{ top: '8%', right: '12%', width: 56, height: 56 }} />
        <Blob tone="lilac" slot="b" style={{ bottom: '10%', left: '18%', width: 38, height: 38 }} />
        <Blob tone="sky" slot="c" style={{ top: '22%', left: '8%', width: 32, height: 32 }} />
        <div className={styles.wordmarkWrap}>
          <span className={styles.wordmark}>PinGo</span>
        </div>
      </BlobHero>

      <Title center>
        사용할 언어를
        <br />
        선택해 주세요
      </Title>
      <Sub center style={{ marginTop: 8 }}>
        Please select your language
      </Sub>

      <LanguageSelect />

      <Spring />
      <ButtonLink to={USER_ROUTES.PERMISSION}>계속하기 · Continue</ButtonLink>
    </PhoneFrame>
  );
}
