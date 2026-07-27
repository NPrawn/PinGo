import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/shared/config';
import { Blob, BlobHero, BlobPin, Icon, Icon3d, PillButton } from '@/shared/ui';
import type { Icon3dTone, IconName } from '@/shared/ui';
import styles from './HomePage.module.css';

type Role = {
  to: string;
  nameKey: string;
  descKey: string;
  icon: IconName;
  tone: Icon3dTone;
};

const ROLES: readonly Role[] = [
  {
    to: ROUTES.USER,
    nameKey: 'page.user',
    descKey: 'home.role.user',
    icon: 'person',
    tone: 'mint',
  },
  {
    to: ROUTES.COUNSELOR,
    nameKey: 'page.counselor',
    descKey: 'home.role.counselor',
    icon: 'headset',
    tone: 'coral',
  },
  {
    to: ROUTES.ADMIN,
    nameKey: 'page.admin',
    descKey: 'home.role.admin',
    icon: 'gear',
    tone: 'lilac',
  },
];

const FEATURES: readonly { key: string; icon: IconName }[] = [
  { key: 'locate', icon: 'camera' },
  { key: 'route', icon: 'compass' },
  { key: 'consult', icon: 'chat' },
];

/** Entry page — brand introduction and the three role consoles. */
export function HomePage() {
  const { t, i18n } = useTranslation();
  const isKorean = i18n.language === 'ko';

  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff" aria-hidden>
              <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
            </svg>
          </span>
          <span className={styles.brandName}>{t('app.title')}</span>
        </div>
        <PillButton onClick={() => void i18n.changeLanguage(isKorean ? 'en' : 'ko')}>
          <Icon name="globe" size={14} />
          {isKorean ? 'English' : '한국어'}
        </PillButton>
      </header>

      <section className={styles.hero}>
        <BlobHero className={styles.heroBlobs}>
          <Blob slot="main" style={{ width: 168, height: 168 }} />
          <Blob tone="coral" slot="a" style={{ top: '8%', right: '18%', width: 50, height: 50 }} />
          <Blob
            tone="lilac"
            slot="b"
            style={{ bottom: '10%', left: '18%', width: 40, height: 40 }}
          />
          <Blob tone="sky" slot="c" style={{ top: '20%', left: '10%', width: 32, height: 32 }} />
          <BlobPin>
            <Icon name="pin" size={26} className={styles.heroPinIcon} />
          </BlobPin>
        </BlobHero>

        <span className={styles.eyebrow}>
          <Icon name="train" size={13} />
          {t('home.eyebrow')}
        </span>

        {/* The brand name is the page's h1; the headline follows as h2. */}
        <h1 className="sr-only">{t('app.title')}</h1>
        <h2 className={styles.headline}>{t('home.headline')}</h2>
        <p className={styles.lede}>{t('home.lede')}</p>
      </section>

      <section className={styles.section} aria-labelledby="home-consoles">
        <h3 id="home-consoles" className={styles.sectionTitle}>
          {t('home.enterTitle')}
        </h3>
        <nav className={styles.roles} aria-label={t('home.enterTitle')}>
          {ROLES.map((role) => (
            <Link key={role.to} to={role.to} className={styles.role}>
              <Icon3d name={role.icon} tone={role.tone} />
              <span className={styles.roleName}>{t(role.nameKey)}</span>
              <span className={styles.roleDesc}>{t(role.descKey)}</span>
              <span className={styles.roleGo}>
                {t('home.enter')}
                <Icon name="arrow-right" size={13} />
              </span>
            </Link>
          ))}
        </nav>
      </section>

      <section className={styles.features}>
        {FEATURES.map((feature) => (
          <div key={feature.key} className={styles.feature}>
            <span className={styles.featureIcon}>
              <Icon name={feature.icon} size={16} />
            </span>
            <div>
              <div className={styles.featureTitle}>{t(`home.feature.${feature.key}.title`)}</div>
              <div className={styles.featureDesc}>{t(`home.feature.${feature.key}.desc`)}</div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
