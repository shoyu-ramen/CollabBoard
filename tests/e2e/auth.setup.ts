import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/e2e/.auth/user.json';
const TEST_EMAIL = 'e2e-test@collabboard.test';
const TEST_PASSWORD = 'TestPassword123!';

/**
 * Ensure a test user exists via the Supabase Admin API, then log in
 * through the browser so the auth cookies are saved for reuse.
 */
setup('authenticate', async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. ' +
        'Ensure .env.local is present.'
    );
  }

  // Create the test user via Supabase Admin API (idempotent —
  // if user already exists we just sign in below)
  const createRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      }),
    }
  );

  // 200 = created, 422 = already exists — both are fine
  if (!createRes.ok && createRes.status !== 422) {
    const body = await createRes.text();
    console.warn(`Create user response ${createRes.status}: ${body}`);
  }

  // Log in through the browser so cookies are set correctly
  await page.goto('/login');

  await page.locator('#email').fill(TEST_EMAIL);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
