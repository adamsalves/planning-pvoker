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

    // Verify subject was added to backlog (plural nativo do i18n → singular em 1)
    await expect(adminPage.locator('text=Fix CSS bugs')).toBeVisible()
    await expect(adminPage.locator('text=Backlog (1 subject)')).toBeVisible()

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
    // Deck Fibonacci => carta "5", alvejada pelo nome acessível (aria-label "Votar 5").
    const voteCard = memberPage.getByRole('button', { name: 'Votar 5' })
    await expect(voteCard).toBeVisible()
    await voteCard.click()

    // Member should see their vote selected (otimista + confirmado pelo servidor)
    await expect(voteCard).toHaveAttribute('aria-pressed', 'true')

    // -- ADMIN REVEALS --
    await adminPage.waitForTimeout(500)
    await adminPage.click('button:has-text("👁️ Revelar Votos")')

    // -- VERIFY REVEAL --
    // A rodada revelada aparece na aba "Votação" E na "Resumo (1)" (F6.1; ambas ficam
    // montadas via v-show) → escopar no painel de votação visível p/ evitar ambiguidade.
    const adminVoting = adminPage.locator('#room-panel-voting')
    await expect(adminVoting.getByText('Consenso!')).toBeVisible()
    await expect(adminVoting.locator('.stat-value:has-text("5")').first()).toBeVisible()

    await expect(memberPage.locator('#room-panel-voting').getByText('Consenso!')).toBeVisible()

    // -- ADMIN FINISHES SESSION (last subject) --
    await adminPage.click('button:has-text("✅ Finalizar Sessão")')

    // Should see session summary
    await expect(adminPage.locator('text=Sessão Concluída!')).toBeVisible()
    await expect(adminPage.locator('text=1 subject votado')).toBeVisible()

    // -- ADMIN LEAVES (pela tela de sessão concluída; saída imediata, sem modal) --
    // O header também tem um "Sair da Sala" (que abre o modal de confirmação, F3.4),
    // então alveja o botão DENTRO do SessionSummary p/ evitar match ambíguo (strict mode).
    await adminPage
      .locator('.session-summary')
      .getByRole('button', { name: 'Sair da Sala' })
      .click()
    await adminPage.waitForURL('/')

    // Close contexts
    await adminContext.close()
    await memberContext.close()
  })
})
