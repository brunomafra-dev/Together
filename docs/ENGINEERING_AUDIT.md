# Engineering Audit

Data: 2026-06-30

## Contexto

Together e uma aplicacao React + Vite + TypeScript com Supabase. Esta auditoria registra melhorias de engenharia sem alterar UX, layout ou regras de negocio.

## Pontos implementados nesta sprint

- Typecheck com `tsc --noEmit`.
- ESLint flat config para TypeScript, React Hooks e React Refresh.
- Prettier e EditorConfig.
- Scripts padronizados: `lint`, `typecheck`, `build`, `check`, `format` e `format:check`.
- CI no GitHub Actions com instalacao, lint, typecheck e build.
- Dependabot para npm e GitHub Actions.
- CodeQL para JavaScript/TypeScript.
- Licenca MIT e documentos de contribuicao, seguranca e conduta.
- Remocao de bloco morto em `Settings.tsx`.
- Atualizacao de `react-router` para corrigir vulnerabilidade alta reportada por `npm audit`.

## Arquitetura

Arquivos acima de 500 linhas que merecem refatoracao futura:

- `src/app/components/Goals.tsx`: 1245 linhas.
- `src/services/financeService.ts`: 1115 linhas.
- `src/app/components/Settings.tsx`: 1108 linhas.
- `src/app/components/Dashboard.tsx`: 1068 linhas.
- `src/app/context/FinanceContext.tsx`: 866 linhas.
- `src/app/components/Installments.tsx`: 767 linhas.
- `src/app/components/ui/sidebar.tsx`: 726 linhas.

Recomendacoes futuras:

- Dividir `financeService.ts` por dominio: household, expenses, income, goals, commitments, snapshots.
- Separar `FinanceContext` em estado, actions e selectors.
- Extrair subcomponentes de `Goals`, `Dashboard` e `Settings`.
- Criar testes unitarios para calculos financeiros antes de refatorar regras.
- Regerar tipos oficiais do Supabase via CLI e remover casts/`any` progressivamente.

## Supabase

Achados:

- RLS existe para tabelas principais nos SQLs versionados.
- Policies usam `auth.uid()` e associacao por `household_members`.
- Bucket `profile-photos` e publico para leitura.
- O frontend usa `VITE_SUPABASE_ANON_KEY`, apropriado para cliente, mas depende das policies.
- Os tipos locais de Supabase sao manuais e devem ser regenerados a partir do banco real.

Riscos:

- Leitura publica de fotos de perfil pode ser desejada, mas deve ser uma decisao consciente de produto.
- Service concentrado aumenta risco de queries inconsistentes.
- Faltam testes automatizados para validar isolamento por household.
- SQLs incrementais podem divergir do banco real se aplicados fora de ordem.

## Performance

Achados:

- Build atual gera um chunk JS de aproximadamente 742 kB minificado.
- Rotas principais sao importadas de forma estatica em `routes.tsx`.
- Ha warnings de hooks sobre dependencias e efeitos sincronizando estado.
- Algumas imagens usam `<img>` diretamente, adequado em Vite, mas ainda exigem dimensoes/otimizacao manual.

Recomendacoes futuras:

- Introduzir lazy loading por rota com `React.lazy` e `Suspense`.
- Avaliar divisao de vendor chunks no Vite depois de medir impacto.
- Resolver warnings de hooks com refatoracoes pequenas e testes.
- Auditar dependencias nao usadas antes de remover bibliotecas visuais.
