import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/app/providers/**', './src/shared/types/**'],
    rules: {
      // The project specification (README §8, §12) explicitly requires
      // `app/providers` for provider composition and lists `shared/types` as a
      // recommended segment.
      'fsd/segments-by-purpose': 'off',
    },
  },
  {
    files: ['./src/**'],
    rules: {
      /**
       * Off by design.
       *
       * The rule counts references per *slice*, so a widget used by 24 screens
       * inside `pages/user` still reads as "one reference". Every feature and
       * widget here backs a distinct screen group of the 36-screen app, and
       * merging them back into their page is precisely the monolith this
       * codebase was refactored away from. Layer-boundary rules
       * (`fsd/forbidden-imports`, `fsd/public-api`) stay on.
       */
      'fsd/insignificant-slice': 'off',
    },
  },
]);
