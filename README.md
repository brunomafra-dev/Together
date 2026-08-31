<div align="center">

# Together

**Controle financeiro para casais acompanharem gastos, renda, contas fixas, metas e fechamento mensal.**

![React](https://img.shields.io/badge/React-111827?style=for-the-badge&logo=react&logoColor=38bdf8)
![Vite](https://img.shields.io/badge/Vite-111827?style=for-the-badge&logo=vite&logoColor=facc15)
![TypeScript](https://img.shields.io/badge/TypeScript-111827?style=for-the-badge&logo=typescript&logoColor=60a5fa)
![Supabase](https://img.shields.io/badge/Supabase-111827?style=for-the-badge&logo=supabase&logoColor=34d399)

[Demo](https://togetherbr.vercel.app/) · [Portfólio](https://www.brunomafra.website/pt)

</div>

---

## Descrição do problema

Casais costumam dividir decisões financeiras entre conversas, planilhas, extratos e aplicativos separados. Isso dificulta responder perguntas simples: quanto entrou, quanto já foi comprometido, o que ainda está livre para gastar e qual será o impacto nos próximos meses.

O problema não é só registrar gastos; é dar uma visão compartilhada do mês e dos compromissos futuros.

## Solução proposta

O Together centraliza o planejamento financeiro do casal em um fluxo único:

- renda mensal e entradas extras;
- gastos do mês;
- contas fixas e valores variáveis;
- parcelas, assinaturas e compromissos;
- metas, submetas e aportes;
- fechamento mensal com histórico e reabertura.

O foco é uma experiência clara no celular, com leitura rápida do estado financeiro atual e projeção dos próximos meses.

## Stack utilizada

| Camada     | Tecnologias                                   |
| ---------- | --------------------------------------------- |
| Frontend   | React, Vite, TypeScript, Tailwind CSS         |
| UI         | Lucide React, Sonner, componentes responsivos |
| Dados      | Supabase, SQLs versionados e cache local      |
| Estado     | Contextos de autenticação e finanças          |
| Relatórios | Exportação CSV e snapshots mensais            |

## Arquitetura resumida

```txt
src/
  app/
    components/
    context/
    routes/
    utils/
  lib/
    supabase.ts
    database.types.ts
  services/
    financeService.ts
supabase_setup.sql
supabase_*_sql
```

## Screenshots

| Tela                 | O que demonstrar                                |
| -------------------- | ----------------------------------------------- |
| Visão do mês         | Renda, gastos, saldo livre e resumo financeiro  |
| Gastos e categorias  | Registro, edição, filtros e exportação CSV      |
| Compromissos futuros | Parcelas, assinaturas, contas fixas e projeções |
| Metas e fechamento   | Metas, histórico mensal e fechamento/reabertura |

> As capturas devem ser adicionadas em `docs/screenshots/` quando houver uma rodada visual final da demo pública.

## Funcionalidades

- Autenticação e dados por casal com Supabase.
- Registro, edição, filtro e exportação CSV de gastos.
- Separação entre quem registrou e quem pagou.
- Categorias, formas de pagamento e cartões com limite.
- Contas fixas com valores fixos ou variáveis por mês.
- Parcelamentos e compromissos sem cartão.
- Assinaturas e compras recorrentes na projeção futura.
- Rendas planejadas e entradas extras.
- Metas, submetas e adição de valores.
- Fechamento mensal com histórico, reabertura e resumo.
- Ciclo financeiro fechado somente por ação manual, com data real de início e fim.
- Faturas calculadas pelo fechamento e vencimento configurados em cada cartão no Perfil.
- Interface responsiva, mobile-first e com modo escuro.

## Roadmap

- Adicionar screenshots reais em `docs/screenshots/`.
- Evoluir o tour individual depois do fluxo de convite do parceiro.
- Evoluir relatórios por categoria, método de pagamento e período.
- Melhorar projeção de longo prazo para compromissos recorrentes.
- Consolidar testes automatizados para regras financeiras.
- Criar documentação de decisões de produto e dados.

## Aprendizados

- Produtos financeiros precisam transformar dados em decisão, não apenas em lista.
- Casais precisam de contexto compartilhado e linguagem simples.
- Fechamento mensal exige histórico, reabertura e consistência de snapshots.
- Cache local melhora percepção de velocidade, mas precisa respeitar sincronização.
- Modelagem de dados define a clareza das telas de projeção.

## Como executar

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Valide o build:

```bash
npm run build
```

Valide a qualidade completa:

```bash
npm run check
npm run format:check
```

Scripts disponíveis:

| Script                 | Descrição                                 |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Inicia o ambiente local com Vite.         |
| `npm run lint`         | Executa ESLint.                           |
| `npm run typecheck`    | Executa TypeScript sem emitir arquivos.   |
| `npm run test`         | Executa os testes unitários uma vez.      |
| `npm run build`        | Gera o build de produção.                 |
| `npm run check`        | Roda lint, typecheck, testes e build.     |
| `npm run format`       | Aplica Prettier.                          |
| `npm run format:check` | Verifica formatação sem alterar arquivos. |

Em uma instância que já contenha as tabelas-base do projeto (`profiles`, `households`,
`household_members`, `cards`, `categories` e `expenses`), aplique os SQLs na ordem apresentada:

```text
supabase_setup.sql
supabase_rls_foundation.sql
supabase_fixed_expense_amount_type.sql
supabase_fixed_expense_monthly_values.sql
supabase_income_entries.sql
supabase_goals_commitments.sql
supabase_goal_plan_allocation_modes.sql
supabase_financial_commitments_category.sql
supabase_category_budget_links.sql
supabase_expense_recurring_monthly.sql
supabase_manual_financial_cycles_and_invoices.sql
supabase_finance_integrity_v2.sql
supabase_invoice_closing_competence.sql
supabase_household_partner_2_nullable.sql
supabase_financial_routine_onboarding.sql
supabase_financial_routine_cycle_alignment.sql
```

`supabase_rls_foundation.sql` deve ser aplicado depois do setup e antes de metas/compromissos. Ele
remove a policy recursiva de membros, cria `is_household_member` antes das policies que dependem
dela e instala a RPC sem argumentos `bootstrap_current_user_household` usada pelo cliente atual.
O cliente autenticado só pode ler membros; bootstrap é a única escrita disponível até que um fluxo
de convites ganhe uma RPC validada. A mesma migração limita novos avatares a 5 MB, JPEG/PNG/WebP e
ao objeto único `<household_id>/avatar`, mantendo a leitura pública e sem apagar arquivos legados.

Em um banco já existente que já recebeu a migração de ciclos, aplique
`supabase_rls_foundation.sql`, reaplique a versão atual de
`supabase_manual_financial_cycles_and_invoices.sql`, depois
`supabase_finance_integrity_v2.sql` e as migrações posteriores da lista. A reaplicação mantém a RPC
original e instala nela o predicado defensivo; seus backfills ignoram ciclos fechados. As migrações
são idempotentes e não exigem recriar os dados.

Essa migração preserva os meses antigos como ciclos de calendário, congela fechamento/vencimento
nas compras de crédito e torna o fechamento/abertura do próximo ciclo uma operação transacional.
O dia não é fixo no código: uma compra feita no dia de fechamento informado no cartão permanece na
fatura atual; somente compras posteriores seguem para a próxima fatura. O app bloqueia o fechamento
em data futura e exige essa migração para não salvar um histórico parcial.

`supabase_finance_integrity_v2.sql` torna as datas de fatura autoritativas no banco para novos
lançamentos e alterações de cartão/data, sem recalcular datas históricas já persistidas. Ele também
normaliza parcelamentos concluídos (por exemplo, `12/12`) como `finished`, mantém a assinatura
pública e a implementação original da RPC de fechamento e exige que cartões, categorias e valores
mensais pertençam ao mesmo domicílio de seus lançamentos. Também adiciona índices para esses
caminhos. Se encontrar uma relação
legada inválida, a migração para com a contagem por relação, sem corrigir ou apagar dados sozinha.

As migrações de rotina financeira devem ser aplicadas por último. A primeira persiste o tipo de
renda e a regra de virada; a segunda alinha o ciclo inicial somente quando a casa ainda não possui
gastos, rendas ou snapshots. Casas com atividade financeira preservam integralmente o ciclo já
aberto. `supabase_invoice_closing_competence.sql` mantém o fechamento da fatura como data de
competência e deve permanecer depois da migração de integridade.

## Engenharia e manutenção

- A auditoria técnica está em [`docs/ENGINEERING_AUDIT.md`](docs/ENGINEERING_AUDIT.md).
- O CI executa instalação, lint, typecheck e build no GitHub Actions.
- Dependabot acompanha dependências npm e GitHub Actions.
- CodeQL analisa JavaScript e TypeScript.
- Não commite `.env`, service role keys ou credenciais privadas.

## Link para Demo

https://togetherbr.vercel.app/

## Link para Portfólio

https://www.brunomafra.website/pt
