import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/shared/config';

export function HomePage() {
  const { t, i18n } = useTranslation();

  return (
    <main>
      <h1>{t('app.title')}</h1>
      <h2>{t('page.home')}</h2>
      <nav aria-label="main navigation">
        <Link to={ROUTES.USER}>{t('page.user')}</Link>
        <Link to={ROUTES.COUNSELOR}>{t('page.counselor')}</Link>
        <Link to={ROUTES.ADMIN}>{t('page.admin')}</Link>
      </nav>
      <button
        type="button"
        onClick={() => void i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko')}
      >
        {i18n.language === 'ko' ? 'English' : '한국어'}
      </button>
    </main>
  );
}
