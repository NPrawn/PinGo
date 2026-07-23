import { useTranslation } from 'react-i18next';

export function CounselorPage() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('page.counselor')}</h1>
    </main>
  );
}
