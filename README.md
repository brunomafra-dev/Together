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
- Refinar onboarding do casal e convite do parceiro.
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

| Script                 | Descrição                                  |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Inicia o ambiente local com Vite.          |
| `npm run lint`         | Executa ESLint.                            |
| `npm run typecheck`    | Executa TypeScript sem emitir arquivos.    |
| `npm run build`        | Gera o build de produção.                  |
| `npm run check`        | Roda lint, typecheck e build em sequência. |
| `npm run format`       | Aplica Prettier.                           |
| `npm run format:check` | Verifica formatação sem alterar arquivos.  |

Em uma instância que já contenha as tabelas-base do projeto (`profiles`, `households`,
`household_members`, `cards`, `categories` e `expenses`), aplique os SQLs nesta ordem (a migração
de ciclos deve ser a última):

```text
supabase_setup.sql
supabase_fixed_expense_amount_type.sql
supabase_fixed_expense_monthly_values.sql
supabase_income_entries.sql
supabase_goals_commitments.sql
supabase_manual_financial_cycles_and_invoices.sql
```

Em um banco já existente, confirme que os três SQLs complementares de valores mensais, rendas e
metas/compromissos já foram aplicados antes de executar a migração de ciclos.

Essa migração preserva os meses antigos como ciclos de calendário, congela fechamento/vencimento
nas compras de crédito e torna o fechamento/abertura do próximo ciclo uma operação transacional.
O dia não é fixo no código: uma compra feita no dia de fechamento informado no cartão permanece na
fatura atual; somente compras posteriores seguem para a próxima fatura. O app bloqueia o fechamento
em data futura e exige essa migração para não salvar um histórico parcial.

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
