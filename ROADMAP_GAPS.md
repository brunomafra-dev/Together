# Together Production Readiness Gaps

## Estado atual

- Metas, divisões de planejamento e linhas de progresso possuem leitura e CRUD no Supabase.
- Compromissos financeiros possuem criação, edição e exclusão pela tela Cartões e parcelas.
- Categorias personalizadas podem ser criadas, editadas, apagadas e vinculadas ao planejamento.
- Ciclos são fechados e reabertos por RPC transacional, usando o fechamento da fatura como
  competência das compras de crédito.
- A rotina financeira pode ser configurada no onboarding e no Perfil; ciclos vazios são alinhados
  com segurança e ciclos com atividade são preservados.

## Lacunas restantes

- O convite e ingresso do segundo parceiro em uma casa compartilhada ainda precisam de fluxo
  dedicado.
- O tutorial de configuração é da casa. Um tour individual por usuário pode ser adicionado quando o
  fluxo de convites existir.
- Policies, triggers e concorrência das RPCs ainda precisam de testes automatizados contra uma
  instância PostgreSQL/Supabase de integração.
- `FinanceContext`, `financeService`, Dashboard e Settings continuam extensos e devem ser separados
  gradualmente por domínio.
- Relatórios comparativos entre ciclos e exportações mais completas ainda podem evoluir.

## Próximos passos recomendados

1. Implementar convite e aceite do parceiro com RPC validada.
2. Criar suíte de integração para RLS, fechamento, reabertura e alinhamento do ciclo inicial.
3. Separar estado e serviços por domínio sem alterar os contratos financeiros existentes.
4. Medir os fluxos reais de onboarding antes de adicionar um tour individual por usuário.
