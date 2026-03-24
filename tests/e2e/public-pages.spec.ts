import { test, expect } from '@playwright/test'

test.describe('Public Pages', () => {
  test('homepage loads with hero section', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Roosk/)
    await expect(page.locator('text=Network Intelligence')).toBeVisible()
  })

  test('platform page loads', async ({ page }) => {
    await page.goto('/platform')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('services page loads', async ({ page }) => {
    await page.goto('/services')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('industries page loads', async ({ page }) => {
    await page.goto('/industries')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('about page loads', async ({ page }) => {
    await page.goto('/about')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('contact page loads with form', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('navigation links work', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Platform')
    await expect(page).toHaveURL('/platform')
    await page.click('text=Services')
    await expect(page).toHaveURL('/services')
  })

  test('contact form validates required fields', async ({ page }) => {
    await page.goto('/contact')
    await page.click('button[type="submit"]')
    // HTML5 validation should prevent submission
    const nameInput = page.locator('input[type="text"]').first()
    await expect(nameInput).toHaveAttribute('required', '')
  })

  test('mobile menu toggles', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    // Mobile menu button should be visible
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
    await expect(menuBtn).toBeVisible()
  })

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page')
    await expect(page.locator('text=404')).toBeVisible()
  })
})
