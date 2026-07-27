import { useTranslation } from 'react-i18next';
import { SelectRow } from '@/shared/ui';
import styles from './LanguageSelect.module.css';

type LanguageOption = {
  code: string;
  short: string;
  name: string;
  native: string;
};

/** The prototype offered Korean and English; `resources` in i18n matches. */
const LANGUAGES: readonly LanguageOption[] = [
  { code: 'ko', short: 'KO', name: '한국어', native: 'Korean' },
  { code: 'en', short: 'EN', name: 'English', native: '영어' },
];

/**
 * Language picker used by onboarding and the settings screen.
 *
 * The prototype kept a local `lang` field; this drives i18next instead, so the
 * choice actually applies to the rest of the app.
 */
export function LanguageSelect() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <div className={styles.options}>
      {LANGUAGES.map((language) => (
        <SelectRow
          key={language.code}
          className={styles.option}
          selected={current === language.code}
          onClick={() => void i18n.changeLanguage(language.code)}
        >
          <span className={styles.code}>{language.short}</span>
          <span className={styles.labels}>
            <b className={styles.name}>{language.name}</b>
            <br />
            <span className={styles.native}>{language.native}</span>
          </span>
        </SelectRow>
      ))}
    </div>
  );
}
