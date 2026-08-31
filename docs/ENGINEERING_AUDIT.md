# Auditoria de engenharia

Data: 2026-08-07

## Contexto

Together é uma aplicação React, Vite e TypeScript com Supabase, usada com dados financeiros reais.
Esta revisão priorizou consistência das regras financeiras, isolamento entre domicílios e mudanças
compatíveis com os dados já existentes.

## Entregue nesta auditoria

- Fechamento de ciclo exclusivamente manual, com histórico e reabertura transacionais.
- Ciclo aberto visível até o horizonte atual, sem ocultar lançamentos quando o fechamento atrasa.
- Resumo de fechamento recalculado para a data escolhida pelo usuário.
- Regra de fatura baseada em `closing_day` e `due_day` do cartão cadastrado, inclusive no banco.
- Datas históricas de fatura preservadas quando a configuração do cartão muda.
- Parcelamentos integralmente pagos excluídos dos compromissos ativos e normalizados como
  `finished`.
- Recorrências deduplicadas por versão e iniciadas pela data efetiva da primeira cobrança.
- Projeção futura sem sobreposição com o ciclo manual ainda aberto.
- Paginação determinística de gastos, rendas e compromissos, sem depender do limite padrão do
  Supabase.
- Sincronização protegida contra respostas obsoletas e estado financeiro isolado por usuário.
- Cache financeiro removido no logout e na troca de conta.
- Rotas protegidas carregadas sob demanda.
- Upload de avatar limitado a 5 MB, JPEG/PNG/WebP e a um objeto por domicílio.
- RLS de membros somente leitura; criação inicial feita por RPC atômica.
- Integridade composta para impedir referências financeiras entre domicílios.
- Scripts SQL legados alinhados ao hardening atual para não reabrirem permissões em uma reaplicação.

## Validação

- ESLint sem erros; permanecem avisos não bloqueantes já mapeados.
- TypeScript executado com `tsc --noEmit`.
- 65 testes unitários cobrindo ciclos, rotina financeira, faturas, recorrências, compromissos e
  resumo de fechamento.
- Build de produção gerado com sucesso.
- `git diff --check` sem erros de whitespace.

Os SQLs receberam revisão estática e defensiva, e o operador confirmou a aplicação das três
migrações finais no Supabase em 2026-08-07. Esta máquina ainda não possui uma instância
PostgreSQL/Supabase local para executar testes automatizados de integração das policies e triggers.

## Riscos e decisões preservadas

- A exclusão de conta não apaga automaticamente um domicílio compartilhado nem seus arquivos. Essa
  regra exige uma decisão explícita de propriedade e transferência; apagar dados automaticamente
  poderia remover informações do outro familiar.
- O bucket de avatar permanece público para manter compatibilidade com as URLs atuais, embora novas
  gravações estejam restritas.
- `npm audit` ainda reporta um advisory alto do React Router exclusivo do modo RSC. O app usa SPA
  com `createBrowserRouter`; a correção indicada exige React Router 8 e não foi forçada por ser uma
  mudança principal sem benefício para o modo atual.
- O chunk inicial foi reduzido, mas ainda fica pouco acima de 500 kB. Uma divisão adicional de
  bibliotecas compartilhadas deve ser feita somente após medição, não como alteração emergencial.

## Próximas melhorias seguras

- Aplicar e validar as migrações primeiro em staging com cópia representativa dos dados.
- Criar testes de integração contra PostgreSQL para RLS, triggers e concorrência de fechamento.
- Dividir gradualmente `FinanceContext`, `financeService` e componentes extensos por domínio, sempre
  mantendo os testes financeiros como rede de segurança.
- Definir a política de proprietário, transferência e retenção antes de ampliar a exclusão de conta.
