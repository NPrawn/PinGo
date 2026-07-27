import { expect, test } from '@playwright/test';

test('navigates between the initial routes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PinGo' })).toBeVisible();
  await page.getByRole('link', { name: '사용자' }).click();
  await expect(page.getByTitle('PinGo 사용자 프로토타입')).toBeVisible();
  const userScreen = page
    .frameLocator('iframe[title="PinGo 사용자 프로토타입"]')
    .locator('#s-splash.pingo-active');
  await expect(userScreen).toBeVisible();

  await page.goto('/counselor');
  await expect(
    page
      .frameLocator('iframe[title="PinGo 상담원 프로토타입"]')
      .locator('#c-login.pingo-active'),
  ).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByTitle('PinGo 관리자 프로토타입')).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="PinGo 관리자 프로토타입"]')
      .locator('#a-console.pingo-active'),
  ).toBeVisible();
});

test('starts navigation from the selected route', async ({ page }) => {
  await page.goto('/pingo-user.html#s-route');

  await expect(page.locator('#s-route.pingo-active')).toBeVisible();
  await page.getByRole('link', { name: '이 경로로 안내 시작' }).click();
  await expect(page).toHaveURL(/#s-nav$/);
  await expect(page.locator('#s-nav.pingo-active')).toBeVisible();
});

test('highlights the navigation consultation request CTA', async ({ page }) => {
  await page.goto('/pingo-user.html#s-nav');

  const consultCta = page.locator('#s-nav.pingo-active .nav-consult-cta');
  const consultIcon = consultCta.locator('svg');
  await expect(consultCta).toBeVisible();
  await expect(consultCta).toHaveCSS('animation-name', 'none');
  await expect(consultIcon).toHaveCSS('animation-name', 'consultIconBounce');
  await expect(consultCta).toHaveCSS(
    'border-top-color',
    'rgba(255, 255, 255, 0.7)',
  );
  await consultCta.click();
  await expect(page).toHaveURL(/#s-consult-req$/);
});

test('highlights the location recognition failure consultation CTA', async ({
  page,
}) => {
  await page.goto('/pingo-user.html#s-fail');

  const consultCta = page.locator('#s-fail.pingo-active .fail-consult-cta');
  await expect(consultCta).toBeVisible();
  await expect(consultCta).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(consultCta).toHaveCSS('color', 'rgb(47, 96, 72)');
  await expect(consultCta).toHaveCSS('border-top-color', 'rgb(118, 207, 163)');
  await consultCta.click();
  await expect(page).toHaveURL(/#s-consult-req$/);
});

test('centers the landscape camera screen vertically', async ({ page }) => {
  await page.goto('/pingo-user.html#s-cam-land');

  const landscapeScreen = page.locator('#s-cam-land.pingo-active');
  await expect(landscapeScreen).toBeVisible();
  await expect(landscapeScreen).toHaveCSS('align-items', 'center');

  const verticalOffset = await landscapeScreen
    .locator('> div:not(.lab)')
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const center = window.innerHeight / 2;
      return Math.abs(rect.top + rect.height / 2 - center);
    });
  expect(verticalOffset).toBeLessThan(2);
});

test('extends portrait phone backgrounds to the viewport height', async ({ page }) => {
  await page.goto('/pingo-user.html#s-splash');

  const phone = page.locator('#s-splash.pingo-active > .phone');
  await expect(phone).toBeVisible();
  await expect(phone).toHaveCSS('height', '726px');

  await page.setViewportSize({ width: 1280, height: 920 });
  await expect(phone).toHaveCSS('height', '896px');
});

test('shows the trimmed nearby station list with the standard CTA height', async ({
  page,
}) => {
  await page.goto('/pingo-user.html#s-station');

  const stationScreen = page.locator('#s-station.pingo-active');
  const continueButton = stationScreen.getByRole('link', {
    name: '이 역으로 계속하기',
  });

  await expect(stationScreen.getByText('삼성역')).toHaveCount(0);
  await expect(continueButton).toBeVisible();
  await expect(continueButton).toHaveCSS('height', '56px');
});

test('moves the reroute modal content down without moving the dismiss action', async ({
  page,
}) => {
  await page.goto('/pingo-user.html#s-reroute');

  const modal = page.locator('#s-reroute.pingo-active .reroute-modal');
  await expect(modal.getByRole('heading', { name: '경로를 이탈했어요' })).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 24)',
  );
  await expect(modal.locator('.reroute-dismiss')).toHaveCSS('transform', 'none');
});

test('requires at least one issue type before requesting consultation', async ({
  page,
}) => {
  await page.goto('/pingo-user.html#s-consult-req');

  const consultRequest = page.locator('#s-consult-req.pingo-active');
  await consultRequest.getByRole('button', { name: '상담 요청하기' }).click();
  await expect(
    consultRequest.getByRole('heading', { name: '문제 유형을 선택해주세요' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#s-consult-req$/);

  await consultRequest.getByRole('button', { name: '확인' }).click();
  await expect(
    consultRequest.getByRole('heading', { name: '문제 유형을 선택해주세요' }),
  ).toHaveCount(0);

  await consultRequest.getByRole('button', { name: '현재 위치를 못 찾겠어요' }).click();
  await consultRequest.getByRole('button', { name: '상담 요청하기' }).click();
  await expect(page).toHaveURL(/#s-consult-perm$/);
  await expect(page.locator('#s-consult-perm.pingo-active')).toBeVisible();
});

test('opens the satisfaction modal automatically after arriving', async ({ page }) => {
  await page.goto('/pingo-user.html#s-arrive');

  await expect(page.locator('#s-arrive.pingo-active')).toBeVisible();
  await expect(page).toHaveURL(/#s-consult-end$/, { timeout: 4000 });
  await expect(page.locator('#s-consult-end.pingo-active')).toBeVisible();
  await page.locator('#s-consult-end.pingo-active [data-n="5"]').click();
  await expect(page).toHaveURL(/#s-dest$/, { timeout: 2000 });
  await expect(page.locator('#s-dest.pingo-active')).toBeVisible();
  await expect(page.locator('#s-dest.pingo-active').getByText('전체 보기')).toHaveCount(
    0,
  );
});
