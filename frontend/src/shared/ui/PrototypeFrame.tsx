import styles from './PrototypeFrame.module.css';

type PrototypeFrameProps = {
  role: 'user' | 'counselor' | 'admin';
  title: string;
};

const prototypeSource = {
  user: '/pingo-user.html#s-splash',
  counselor: '/pingo-counselor.html#c-login',
  admin: '/pingo-admin.html#a-console',
} as const;

export function PrototypeFrame({ role, title }: PrototypeFrameProps) {
  return (
    <iframe
      className={styles.frame}
      src={prototypeSource[role]}
      title={title}
    />
  );
}
