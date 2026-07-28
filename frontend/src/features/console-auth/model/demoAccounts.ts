import { ADMIN_ROUTES, COUNSELOR_ROUTES } from '@/shared/config';

export type ConsoleRole = 'counselor' | 'admin';

export type DemoAccount = {
  id: string;
  pw: string;
  role: ConsoleRole;
  /** Where a successful sign-in lands. */
  landing: string;
};

/**
 * Demo credentials carried over from the prototype.
 *
 * TODO: Replace with the real sign-in endpoint. The JWT storage location,
 * refresh strategy and role claim are not agreed yet, so nothing is persisted
 * and no route guard is installed.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { id: 'counselor', pw: '1234', role: 'counselor', landing: COUNSELOR_ROUTES.REQUESTS },
  { id: 'admin', pw: '1234', role: 'admin', landing: ADMIN_ROUTES.CONSOLE },
];

export function authenticate(id: string, pw: string): DemoAccount | null {
  const normalizedId = id.trim().toLowerCase();
  const normalizedPw = pw.trim();
  return (
    DEMO_ACCOUNTS.find((account) => account.id === normalizedId && account.pw === normalizedPw) ??
    null
  );
}
