import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('page.notFound')}</h1>
    </main>
  );
}
