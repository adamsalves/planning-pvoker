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

    // Fill Create Room form (só o form "Criar" está montado → label "Seu nome" é único aqui)
    await adminPage.getByLabel('Seu nome').fill('ScrumMaster')
    // Escopado no form: a aba tem o mesmo rótulo do submit (o 🚀 saiu da string
    // quando o botão ganhou ícone), então sem o escopo o seletor fica ambíguo.
    await adminPage.locator('form').getByRole('button', { name: 'Criar Sala' }).click()

    // Wait to enter room
    await adminPage.waitForURL(/\/room\//)
    const roomUrl = adminPage.url()
    const match = roomUrl.match(/\/room\/(.+)$/)
    const roomId = match?.[1] || ''
    expect(roomId).not.toBe('')

    // -- ADMIN ADDS SUBJECTS (setup phase) --
    await adminPage.getByLabel('Adicionar subject').fill('Fix CSS bugs')
    await adminPage.getByRole('button', { name: 'Adicionar', exact: true }).click()

    // Verify subject was added to backlog (plural nativo do i18n → singular em 1)
    await expect(adminPage.locator('text=Fix CSS bugs')).toBeVisible()
    await expect(adminPage.locator('text=Backlog (1 subject)')).toBeVisible()

    // -- MEMBER JOINS ROOM --
    await memberPage.goto('/')
    // A aba "Entrar na Sala". Escopado no switcher (e exact) porque o submit do form
    // tem o mesmo nome acessível — não depender de qual form está montado agora.
    await memberPage
      .locator('.tab-switcher')
      .getByRole('button', { name: 'Entrar na Sala', exact: true })
      .click()

    // "Código da sala" só existe no form de entrar → sinaliza que a troca de aba concluiu.
    await expect(memberPage.getByLabel('Código da sala')).toBeVisible()

    // Fill Join Room form (o Transition out-in desmonta o "Criar" → "Seu nome" é único).
    await memberPage.getByLabel('Seu nome').fill('Dev 1')
    await memberPage.getByLabel('Código da sala').fill(roomId)
    // Role defaults to member, so we just join (escopado no form: a aba repete o rótulo)
    await memberPage
      .locator('form')
      .getByRole('button', { name: 'Entrar na Sala' })
      .click({ force: true })

    await memberPage.waitForURL(roomUrl)

    // Member should see the subjects in the setup phase
    await expect(memberPage.locator('text=Fix CSS bugs')).toBeVisible()

    // -- ADMIN STARTS SESSION --
    await adminPage.getByRole('button', { name: 'Iniciar Sessão de Votação' }).click()

    // Both should see the round header with "Fix CSS bugs"
    await expect(adminPage.locator('text=Fix CSS bugs')).toBeVisible()
    await expect(memberPage.locator('text=Fix CSS bugs')).toBeVisible()

    // Both should see progress "Subject 1/1"
    await expect(adminPage.locator('text=Subject 1/1')).toBeVisible()

    // -- MEMBER VOTES --
    // Deck Fibonacci => carta "5", pelo nome acessível EXATO (aria-label "Votar 5"; exact
    // blinda contra decks futuros com valores como "55").
    const voteCard = memberPage.getByRole('button', { name: 'Votar 5', exact: true })
    await expect(voteCard).toBeVisible()
    await voteCard.click()

    // Member should see their vote selected (otimista + confirmado pelo servidor)
    await expect(voteCard).toHaveAttribute('aria-pressed', 'true')

    // -- ADMIN REVEALS --
    await adminPage.waitForTimeout(500)
    // Sem `exact` de propósito: aqui só o member vota (o admin conta como ativo e
    // nunca vota), então o nome acessível é só "Revelar Votos". Se o fluxo passar a
    // ter todos votando, o botão anexa "(todos votaram!)" e um match exato quebraria.
    await adminPage.getByRole('button', { name: 'Revelar Votos' }).click()

    // -- VERIFY REVEAL --
    // A rodada revelada aparece na aba "Votação" E na "Resumo (1)" (F6.1; ambas ficam
    // montadas via v-show) → escopar no painel de votação visível p/ evitar ambiguidade.
    const adminVoting = adminPage.locator('#room-panel-voting')
    await expect(adminVoting.getByText('Consenso!')).toBeVisible()
    await expect(adminVoting.locator('.stat-value:has-text("5")').first()).toBeVisible()

    await expect(memberPage.locator('#room-panel-voting').getByText('Consenso!')).toBeVisible()

    // -- ADMIN FINISHES SESSION (last subject) --
    await adminPage.getByRole('button', { name: 'Finalizar Sessão', exact: true }).click()

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
