import '@testing-library/jest-dom/vitest';
import '@/shared/i18n';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
