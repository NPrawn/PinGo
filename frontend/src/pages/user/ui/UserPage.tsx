import { useTranslation } from 'react-i18next';

export function UserPage() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('page.user')}</h1>
    </main>
  );
}
