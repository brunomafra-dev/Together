# Security Policy

## Supported Versions

Este projeto acompanha a versao principal em `main`.

## Reporting a Vulnerability

Se encontrar uma vulnerabilidade, reporte de forma privada ao mantenedor antes de abrir uma issue publica.

Inclua:

- descricao do problema;
- passos de reproducao;
- impacto esperado;
- sugestao de mitigacao, se houver.

## Secrets

Nunca commite `.env`, service role keys, tokens pessoais ou credenciais do Supabase. O frontend deve usar apenas chaves publicas apropriadas para cliente, como `VITE_SUPABASE_ANON_KEY`.
