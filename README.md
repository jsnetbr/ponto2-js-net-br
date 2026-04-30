# ponto.js.net.br

Aplicativo web de controle de ponto com React + Supabase (email/senha).

## Requisitos

- Node.js 20+
- Projeto Supabase criado

## Configuracao

1. Copie `.env.example` para `.env`.
2. Preencha:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Banco Supabase

1. Execute `supabase/migrations/001_init_ponto_schema.sql` no SQL Editor do Supabase.
2. Confirme RLS ativo para `profiles`, `user_settings` e `punches`.

## Executar localmente

```bash
npm install
npm run dev
```

Abrir: `http://localhost:3000`

## Validacao

```bash
npm run lint
npm run test:unit
npm run build
```
