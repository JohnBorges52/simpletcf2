# Scripts utilitários (Functions)

## Backfill de campos em usuários existentes

Para adicionar os campos padrão em **todos os usuários já criados**, execute:

```bash
cd functions
npm run backfill:users
```

O script `backfill-user-fields.js`:
- lê todos os usuários do Firebase Auth;
- garante o documento `/users/{uid}` para cada usuário;
- adiciona **somente campos ausentes** (não sobrescreve valores já existentes).

Pré-requisito: credenciais do Firebase Admin configuradas no ambiente (ex.: `GOOGLE_APPLICATION_CREDENTIALS`).
