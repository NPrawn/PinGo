import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ensureUserSession, useUserSessionStore } from '@/entities/user-session';
import { USER_ROUTES } from '@/shared/config';
import { en, ko } from '@/shared/i18n';
import { Blob, BlobHero, Button, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { LanguageSelect } from '@/features/language-select';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './LanguagePage.module.css';

/** Screen 02 (FR-U-001) — language selection. */
export function LanguagePage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const setLanguage = useUserSessionStore((state) => state.setLanguage);
  // The language picker itself always opens in English, just like the intro splash.
  // Once the user makes a choice, its labels immediately follow that selection.
  const [selectedLanguage, setSelectedLanguage] = useState<'ko' | 'en'>('en');
  const [isStarting, setIsStarting] = useState(false);
  const copy = selectedLanguage === 'en' ? en.translation.user.language : ko.translation.user.language;

  const startSession = async () => {
    if (isStarting) return;
    setIsStarting(true);
    const userSessionId = await ensureUserSession(selectedLanguage);
    if (userSessionId) {
      setLanguage(selectedLanguage);
      await i18n.changeLanguage(selectedLanguage);
      navigate(USER_ROUTES.PERMISSION);
      return;
    }
    setIsStarting(false);
  };

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

      <Title center style={{ whiteSpace: 'pre-line' }}>
        {copy.heading}
      </Title>
      <Sub center style={{ marginTop: 8 }}>
        {copy.description}
      </Sub>

      <LanguageSelect
        value={selectedLanguage}
        onChange={setSelectedLanguage}
      />

      <Spring />
      <Button disabled={isStarting} onClick={() => void startSession()}>
        {copy.continue}
      </Button>
    </PhoneFrame>
  );
}
