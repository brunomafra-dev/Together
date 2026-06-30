# Contributing

Obrigado por contribuir com o Together.

## Antes de abrir uma mudanca

- Mantenha a experiencia do usuario e as regras de negocio existentes, salvo quando a mudanca pedir o contrario.
- Prefira alteracoes pequenas, revisaveis e acompanhadas de validacao local.
- Nunca commite arquivos de ambiente, secrets, `dist/` ou `node_modules/`.

## Setup local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` antes de usar fluxos que dependem do Supabase.

## Qualidade

Rode antes de enviar uma mudanca:

```bash
npm run check
npm run format:check
```

Use `npm run format` para aplicar a formatacao padrao.

## Banco de dados

Os arquivos `supabase_*.sql` documentam a evolucao manual do schema. Mudancas no banco devem ser revisadas com cuidado e aplicadas fora do fluxo de build do frontend.
