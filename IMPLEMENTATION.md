# Implementação atual do Together

## Domínios financeiros

- `expenses`: gastos e compras, com categoria, responsável, forma de pagamento e datas congeladas
  de fechamento/vencimento da fatura.
- `financial_commitments`: empréstimos, parcelamentos e compromissos com ou sem cartão.
- `fixed_expenses` e `fixed_expense_monthly_values`: contas fixas ou variáveis e seus valores por
  ciclo.
- `income_entries`: entradas extras ou variáveis.
- `goals`, `goal_plan_items` e `goal_progress_rows`: objetivos, planejamento e progresso.
- `monthly_snapshots` e `household_finance_state`: histórico fechado e ciclo atualmente aberto.

A antiga tabela `installments` permanece apenas no schema histórico. O runtime atual não consulta
nem grava nessa tabela; parcelamentos são gerenciados por `financial_commitments`.

## Categorias

As categorias usam UUID e pertencem a uma casa. Elas podem ser criadas, renomeadas, apagadas quando
não possuem lançamentos e vinculadas a uma divisão do planejamento. As categorias iniciais são
criadas somente para uma casa ainda vazia e antes da conclusão do onboarding; uma categoria apagada
pelo usuário não é recriada posteriormente.

Cada divisão do planejamento pode acompanhar um percentual da renda ou manter um valor mensal exato.

## Ciclos e cartões

- O fechamento do ciclo é sempre confirmado pelo usuário.
- Compras de crédito usam `invoice_closing_date` como competência financeira.
- `invoice_due_date` permanece informação de fluxo de caixa e não desloca a compra novamente.
- Ciclos fechados são protegidos por triggers e só podem ser alterados depois da reabertura.
- A rotina financeira configurada define o horizonte planejado de Dashboard, Metas, Cartões e
  Impacto futuro.
- Ao concluir o onboarding, somente uma casa sem gastos, rendas ou snapshots pode alinhar o primeiro
  ciclo automaticamente. Ciclos com atividade nunca são movidos silenciosamente.

## Perfil e onboarding

O Perfil possui um salvamento único para nomes, renda planejada e rotina financeira. O segundo
parceiro é opcional. O guia inicial permite renda fixa, variável ou mista e virada pelo pagamento,
por dia personalizado ou manual. Ele pode ser reaberto em **Perfil → Minha rotina financeira**.

## Estado e persistência

`FinanceContext` coordena o estado compartilhado e o cache local versionado. `financeService`
encapsula as operações Supabase. O cache é apenas uma otimização: a sincronização com o servidor
continua sendo a fonte de verdade.

## Validação

Use a verificação completa antes de publicar:

```bash
npm run check
npm run format:check
```

As migrations necessárias e sua ordem estão documentadas no `README.md`.
