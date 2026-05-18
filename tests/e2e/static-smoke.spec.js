const { test, expect } = require('@playwright/test');

async function expectNoPageErrors(page, action) {
  const errors = [];
  const failedAssets = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.hostname !== '127.0.0.1') return;
    if (url.pathname.startsWith('/api/')) return;
    if (response.status() >= 400) {
      failedAssets.push(`${response.status()} ${url.pathname}`);
    }
  });
  await action();
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
}

test('landing page renders primary content', async ({ page }) => {
  await expectNoPageErrors(page, async () => {
    await page.goto('/landing.html', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/ToiLink/);
    await expect(page.locator('[data-l-section="hero"] h1')).toBeVisible();
    await expect(page.locator('[data-l-hero-primary-cta]')).toBeVisible();
  });

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
});

test('login page shows client validation', async ({ page }) => {
  await expectNoPageErrors(page, async () => {
    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/ToiLink/);
    await page.locator('#btn').click();
    await expect(page.locator('#error')).toBeVisible();
    await expect(page.locator('#error')).toContainText('номер');
  });
});

test('template preview hydrates configured names', async ({ page }) => {
  await expectNoPageErrors(page, async () => {
    await page.goto('/templates/template-1/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Свадебное приглашение/);
    await expect(page.locator('.name--first')).not.toHaveText('');
    await expect(page.locator('.name--second')).not.toHaveText('');
  });
});
