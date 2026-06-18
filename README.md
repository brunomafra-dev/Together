# Together

Together é um app financeiro para casais acompanharem renda, gastos, contas fixas, parcelas, assinaturas, metas e fechamento mensal em um só lugar.

O foco do projeto é ser simples de usar no celular, com uma visão clara do que está livre para gastar hoje e do impacto das decisões nos próximos meses.

## Funcionalidades

- Autenticação e dados por casal com Supabase.
- Registro, edição, filtro e exportação CSV de gastos.
- Separação entre quem registrou e quem pagou o gasto.
- Categorias, formas de pagamento e cartões com limite.
- Contas fixas com valores fixos ou variáveis por mês.
- Parcelamentos, compromissos sem cartão e impacto no limite.
- Assinaturas e compras recorrentes separadas na projeção futura.
- Rendas planejadas e entradas extras do mês.
- Metas, submetas e adição de valores.
- Fechamento mensal com histórico, reabertura e resumo.
- Interface responsiva, mobile-first e com modo escuro.

## Stack

- React
- Vite
- TypeScript
- Supabase
- Tailwind CSS
- Lucide React
- Sonner

## Como rodar localmente

Instale as dependências:

```bash
npm install
```

Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

Preencha as variáveis:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Inicie o app:

```bash
npm run dev
```

Valide o build:

```bash
npm run build
```

## Supabase

O projeto usa SQLs versionados na raiz do repositório. Para configurar um banco novo, rode primeiro:

```text
supabase_setup.sql
```

Depois rode os complementos conforme necessário:

```text
supabase_payment_method_types.sql
supabase_expense_recurring_monthly.sql
supabase_financial_commitments_category.sql
supabase_fixed_expense_amount_type.sql
supabase_fixed_expense_monthly_values.sql
supabase_goals_commitments.sql
supabase_household_finance_state.sql
supabase_household_profile_photos.sql
supabase_income_entries.sql
supabase_monthly_financial_cycle.sql
```

As variáveis de ambiente devem usar a URL do projeto Supabase e a chave anon/public. Nunca commite `.env`, `.env.local` ou chaves privadas.

## Estrutura principal

```text
src/app/components      Telas e componentes da aplicação
src/app/context         Contextos de autenticação e finanças
src/app/routes          Rotas do app
src/app/utils           Utilitários de UI/dados
src/lib                 Cliente Supabase e tipos
src/services            Camada de acesso ao Supabase
```

## Status

Projeto em evolução ativa. A versão atual já cobre o fluxo principal de uso real para um casal gerenciar o mês, acompanhar compromissos futuros e revisar histórico financeiro.
