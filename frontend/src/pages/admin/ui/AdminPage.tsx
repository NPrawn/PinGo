import { useTranslation } from 'react-i18next';

// TODO: Apply the agreed authentication and authorization contract before protecting this route.
export function AdminPage() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('page.admin')}</h1>
    </main>
  );
}
