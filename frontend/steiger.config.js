import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/app/providers/**'],
    rules: {
      // The project specification explicitly requires app/providers for provider composition.
      'fsd/segments-by-purpose': 'off',
    },
  },
]);
