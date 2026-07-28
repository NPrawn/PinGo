import { AppRouter } from '@/app/router';
import { IconSprite } from '@/shared/ui';

export function App() {
  return (
    <>
      {/* Icon symbols are defined once here and referenced by `<Icon />`. */}
      <IconSprite />
      <AppRouter />
    </>
  );
}
