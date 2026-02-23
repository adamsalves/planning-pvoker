import { test, expect } from '@playwright/test'

test.describe('Planning Poker E2E Flow', () => {
  test('Completes a full planning poker session with multiple users', async ({ browser }) => {
    // 1. Create Admin Context
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()

    // 2. Create Member Context
    const memberContext = await browser.newContext()
    const memberPage = await memberContext.newPage()

    // -- ADMIN STARTS ROOM --
    await adminPage.goto('/')
    await expect(adminPage).toHaveTitle(/Planning Poker/)

    // Fill Create Room form
    await adminPage.fill('input[placeholder="Ex: João"]', 'ScrumMaster')
    await adminPage.click('button:has-text("🚀 Criar Sala")')

    // Wait to enter room
    await adminPage.waitForURL(/\/room\//)
    const roomUrl = adminPage.url()
    const match = roomUrl.match(/\/room\/(.+)$/)
    const roomId = match?.[1] || ''
    expect(roomId).not.toBe('')

    // -- ADMIN ADDS SUBJECTS (setup phase) --
    await adminPage.fill('input[placeholder="Ex: Implementar endpoint de login"]', 'Fix CSS bugs')
    await adminPage.click('button:has-text("➕ Adicionar")')

    // Verify subject was added to backlog
    await expect(adminPage.locator('text=Fix CSS bugs')).toBeVisible()
    await expect(adminPage.locator('text=Backlog (1 subjects)')).toBeVisible()

    // -- MEMBER JOINS ROOM --
    await memberPage.goto('/')
    await memberPage.click('button:has-text("Entrar na Sala")')

    // Wait for the join room form to appear (tab transition)
    await memberPage.waitForSelector('input[placeholder="Ex: Maria"]', { state: 'visible' })

    // Fill Join Room form
    await memberPage.fill('input[placeholder="Ex: Maria"]', 'Dev 1')
    await memberPage.fill('input[placeholder="Ex: a1b2c3d4"]', roomId)
    // Role defaults to member, so we just join
    await memberPage.click('button:has-text("🔗 Entrar na Sala")', { force: true })

    await memberPage.waitForURL(roomUrl)

    // Member should see the subjects in the setup phase
    await expect(memberPage.locator('text=Fix CSS bugs')).toBeVisible()

    // -- ADMIN STARTS SESSION --
    await adminPage.click('button:has-text("▶️ Iniciar Sessão de Votação")')

    // Both should see the round header with "Fix CSS bugs"
    await expect(adminPage.locator('text=Fix CSS bugs')).toBeVisible()
    await expect(memberPage.locator('text=Fix CSS bugs')).toBeVisible()

    // Both should see progress "Subject 1/1"
    await expect(adminPage.locator('text=Subject 1/1')).toBeVisible()

    // -- MEMBER VOTES --
    // We assume Fibonacci deck => button for "5"
    await expect(memberPage.locator('button:has-text("5")').first()).toBeVisible()
    await memberPage.click('button:has-text("5")')

    // Member should see their vote selected
    await expect(memberPage.locator('button.selected:has-text("5")')).toBeVisible()

    // -- ADMIN REVEALS --
    await adminPage.waitForTimeout(500)
    await adminPage.click('button:has-text("👁️ Revelar Votos")')

    // -- VERIFY REVEAL --
    // Admin and Member should see the VoteReveal component with the results
    await expect(adminPage.locator('text=Consenso!')).toBeVisible()
    await expect(adminPage.locator('.stat-value:has-text("5")').first()).toBeVisible()

    await expect(memberPage.locator('text=Consenso!')).toBeVisible()

    // -- ADMIN FINISHES SESSION (last subject) --
    await adminPage.click('button:has-text("✅ Finalizar Sessão")')

    // Should see session summary
    await expect(adminPage.locator('text=Sessão Concluída!')).toBeVisible()
    await expect(adminPage.locator('text=1 subject votado')).toBeVisible()

    // -- ADMIN LEAVES --
    await adminPage.click('text=Sair da Sala')
    await adminPage.waitForURL('/')

    // Check history
    await adminPage.click('a:has-text("Histórico")')
    await adminPage.waitForURL('/history')
    await expect(adminPage.locator('text=Sala: ' + roomId)).toBeVisible()
    await expect(adminPage.locator('text=Fix CSS bugs')).toBeVisible()

    // Close contexts
    await adminContext.close()
    await memberContext.close()
  })
})
