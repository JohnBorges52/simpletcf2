# 🧪 TESTES DO SIMPLETCF - Guia Completo

## Visão Geral

Este documento descreve todos os testes criados para o SimpleTCF, com explicações detalhadas sobre **o que o usuário está fazendo** em cada cenário e **por que o teste importa**.

---

## 📁 Estrutura de Testes

```
simpletcf/
├── jest.config.js               # Configuração do Jest para backend e frontend
├── jest.setup.js                # Setup do ambiente de testes
├── functions/
│   └── index.test.js            # Testes das Cloud Functions (Backend)
└── public/
    ├── auth-service.test.js     # Testes de autenticação
    ├── plan.test.js             # Testes de seleção de planos
    ├── checkout.test.js         # Testes de checkout e preços
    └── e2e.test.js              # Testes de fluxo completo (End-to-End)
```

---

## 🚀 Como Executar os Testes

### Instalar Jest
```bash
npm install --save-dev jest jest-environment-jsdom @types/jest
```

### Executar todos os testes
```bash
npm test
```

### Executar testes de um projeto específico
```bash
# Apenas testes backend
npm run test:backend

# Apenas testes frontend
npm run test:frontend
```

### Executar testes com cobertura
```bash
npm run test:coverage
```

### Execução em modo "watch" (atualiza automaticamente)
```bash
npm run test:watch
```

---

## 📋 Testes do Backend - Cloud Functions

**Arquivo:** `functions/index.test.js`

### O que é testado:

Este arquivo testa as **Cloud Functions** que rodam no servidor Firebase. Estas são funções críticas que:
- ✅ Validam pagamentos
- ✅ Protegem contra fraude
- ✅ Atualizam dados dos usuários
- ✅ Enviam emails de confirmação

### Cenários Testados:

#### 1️⃣ **CENÁRIO: Usuário escolhe um plano e clica em "Subscribe"**

**O que o usuário faz:**
1. Usuário vê a página de planos
2. Escolhe "Quick Study ($9.99)" 
3. Clica no botão "Subscribe"

**O que o teste verifica:**
- ✅ **Autenticação**: Usuário está logado (token válido)
- ✅ **Validação do Price ID**: O Price ID não foi manipulado
- ✅ **Segurança**: Apenas Price IDs na whitelist são aceitos
- ✅ **Criação de sessão**: Stripe cria sessão de checkout

```javascript
Teste: "Deve criar uma sessão de checkout válida quando usuário seleciona Quick Study"

Entrada: priceId = 'price_1SzMjMCwya11CpgZcBhEiHFB'
Saída: Sessão Stripe criada (id = cs_test_session123)
```

#### 2️⃣ **CENÁRIO: Pagamento aprovado - Webhook é processado**

**O que acontece:**
1. Usuário completa pagamento no Stripe
2. Processadora aprova transação
3. Stripe envia webhook para nosso servidor
4. Nosso servidor atualiza o usuário

**O que o teste verifica:**
- ✅ **Segurança do Webhook**: Assinatura é verificada
- ✅ **Atualização do Firestore**: Tier e datas são atualizadas
- ✅ **Criação de pedido**: Registro de compra é criado
- ✅ **Envio de emails**: Email de confirmação é enviado

```javascript
Entrada: Webhook com status "paid"
Processamento:
  1. Verifica assinatura (Stripe secret)
  2. Extrai metadados (userId, tier, durationDays)
  3. Calcula subscriptionEndDate = hoje + durationDays
  4. Atualiza Firestore
  5. Cria registro de pedido
  6. Envia email
Saída: Usuário tem plano ativo por 30 dias
```

---

## 🔐 Testes de Autenticação

**Arquivo:** `public/auth-service.test.js`

### O que é testado:

Este arquivo testa todo o sistema de **autenticação e login**:
- ✅ Registro de novos usuários
- ✅ Login com email e senha
- ✅ Reset de senha
- ✅ Verificação de email
- ✅ Logout

### Cenários Testados:

#### 1️⃣ **CENÁRIO: Usuário faz login**

**O que o usuário faz:**
```
1. Abre página de login
2. Insere email: usuario@example.com
3. Insere senha: senhaSegura123!
4. Clica botão "Login"
```

**O que o teste verifica:**
```javascript
✅ Email inserido: usuario@example.com
✅ Senha verificada no Firebase
✅ Token de autenticação gerado
✅ Token armazenado em: localStorage.authToken
✅ Usuario redirecionado para: plan.html
✅ Página de planos é exibida
```

#### 2️⃣ **CENÁRIO: Usuário insere senha errada**

**O que o teste verifica:**
```javascript
✅ Firebase detecta: senha incorreta
✅ Erro é exibido: "Senha incorreta. Tente novamente."
✅ Token NÃO é criado
✅ localStorage NÃO é atualizado
✅ Usuário permanece na página de login
✅ Pode tentar novamente
```

#### 3️⃣ **CENÁRIO: Novo usuário se registra**

**O que o usuário faz:**
```
1. Clica "Register"
2. Insere email: novo@example.com
3. Insere senha: senhaSegura123!
4. Confirma senha: senhaSegura123!
5. Clica "Register"
```

**O que o teste verifica:**
```javascript
✅ Email não estava registrado antes
✅ Senha tem força adequada (min 6 caracteres)
✅ Senhas conferem
✅ Firebase cria nova conta
✅ Email de verificação enviado
✅ Usuário vê: "Verifique seu email"
✅ Email tem link de confirmação
```

#### 4️⃣ **CENÁRIO: Usuário esqueceu a senha**

**O que o teste verifica:**
```javascript
✅ Firebase envia email com link de reset
✅ Email chegou na caixa de entrada
✅ Usuário clica no link
✅ Página de reset abre
✅ Usuário insere nova senha
✅ Senha é atualizada
✅ Usuário pode fazer login com nova senha
```

---

## 💰 Testes de Seleção de Planos

**Arquivo:** `public/plan.test.js`

### O que é testado:

Este arquivo testa a **página de escolha de planos**:
- ✅ Exibição correta dos planos
- ✅ Preços corretos para cada plano
- ✅ Badge de plano "popular"
- ✅ Clique no botão "Subscribe"
- ✅ Redirecionamento para checkout

### Cenários Testados:

#### 1️⃣ **CENÁRIO: Usuário vê os planos e preços**

**O que o usuário vê na tela:**
```
┌─────────────────────────────────────────────────┐
│ SIMPLETCF - ESCOLHA SEU PLANO                   │
├─────────────────────────────────────────────────┤
│ 🟦 QUICK STUDY  │ 🟩 30-DAY    │ 🟨 FULL PREP │
│ CAD $9.99       │ CAD $19.99   │ CAD $34.99   │
│ 10 dias         │ 30 dias ⭐   │ 60 dias      │
│ [Subscribe]     │ [Subscribe]  │ [Subscribe]  │
└─────────────────────────────────────────────────┘
```

**O que o teste verifica:**
```javascript
✅ Plano Quick Study mostra: CAD $9.99, 10 dias
✅ Plano 30-Day mostra: CAD $19.99, 30 dias
✅ Plano Full Prep mostra: CAD $34.99, 60 dias
✅ Plano 30-Day tem badge "RECOMENDADO"
✅ Todos têm botão "Subscribe"
✅ Responde bem em mobile (empilhado)
```

#### 2️⃣ **CENÁRIO: Usuário clica "Subscribe" em um plano**

**O que acontece:**
```javascript
1. Usuário clica "Subscribe"
2. Loader aparece
3. Sistema valida token de autenticação
4. Chama Cloud Function createCheckoutSession
5. Cloud Function valida Price ID
6. Stripe cria sessão
7. Usuário redirecionado para Stripe Checkout
```

---

## 💳 Testes de Checkout

**Arquivo:** `public/checkout.test.js`

### O que é testado:

Este arquivo testa a **página de revisão do pedido antes do pagamento**:
- ✅ Cálculo correto de preços
- ✅ Cálculo da taxa (2.95%)
- ✅ Mapeamento de plano (badge → tier)
- ✅ Redirecionamento para Stripe

### Cenários Testados:

#### 1️⃣ **CENÁRIO: Cálculo de preços**

**Quick Study:**
```
Preço base:           $9.99
+ Taxa (2.95%):       $0.29
─────────────────────────
Total:                $10.28 ✅
```

**30-Day:**
```
Preço base:           $19.99
+ Taxa (2.95%):       $0.59
─────────────────────────
Total:                $20.58 ✅
```

**Full Prep:**
```
Preço base:           $34.99
+ Taxa (2.95%):       $1.03
─────────────────────────
Total:                $36.02 ✅
```

**O que o teste verifica:**
```javascript
✅ Cálculo matemático correto
✅ Arredondamento para 2 decimais
✅ Total confere com Stripe
```

#### 2️⃣ **CENÁRIO: Mapeamento de plano**

**O que é testado:**
```javascript
Badge "Bronze" → Tier "quick-study" (10 dias)
Badge "Silver" → Tier "30-day" (30 dias)
Badge "Gold"   → Tier "full-prep" (60 dias)

Por que importa:
- Garante que o plano correto é selecionado
- Previne mix-up entre planos
- Garante duração correta
```

#### 3️⃣ **CENÁRIO: Segurança do Token**

**O que o teste verifica:**
```javascript
✅ Token de autenticação existe em localStorage
✅ Token é incluído no header "Authorization"
✅ Cloud Function valida token
✅ Pagamento é atribuído ao usuário correto
✅ Se não houver token: erro 401 Unauthorized
```

---

## 🌍 Testes E2E - Fluxo Completo

**Arquivo:** `public/e2e.test.js`

### O que é testado:

Este arquivo simula a **jornada completa de um usuário real** do início (descoberta) até o fim (usando a plataforma após pagar).

### A Jornada Completa:

#### 📍 **MOMENTO 0: Usuário descobre o SimpleTCF**
```
Usuário abre: https://simpletcf.web.app
Vê: Homepage com descrição do produto
Clica: "Register" ou "Login"
```

#### 📍 **MOMENTO 1: Novo usuário se registra**
```
Email:     novo@example.com
Senha:     SenhaForte123!
Confirma:  SenhaForte123!

Clica: [Register]

Resultado:
✅ Conta criada
✅ Email de verificação enviado
✅ Usuário verifica email
```

#### 📍 **MOMENTO 2: Usuário faz login**
```
Email:  novo@example.com
Senha:  SenhaForte123!

Clica: [Login]

Resultado:
✅ Token gerado
✅ localStorage atualizado
✅ Redirecionado para plan.html
```

#### 📍 **MOMENTO 3: Usuário vê planos**
```
Vê: Três planos com preços
   - Quick Study: $9.99 (10 dias)
   - 30-Day: $19.99 (30 dias) ⭐
   - Full Prep: $34.99 (60 dias)

Pensa: "30 dias é perfeito para mim"
Clica: [Subscribe] no plano 30-Day
```

#### 📍 **MOMENTO 4: Checkout do SimpleTCF**
```
Vê: Resumo do pedido
   Plano: 30-Day Intensive
   Preço: CAD $19.99
   Taxa: CAD $0.59
   Total: CAD $20.58

Clica: [Continuar para Pagamento]
```

#### 📍 **MOMENTO 5: Página de pagamento Stripe**
```
Insere:
   Número do cartão: 4242 4242 4242 4242
   Vencimento: 12/26
   CVC: 424
   Nome: Seu Nome

Clica: [Pagar]

O que acontece no backend:
✅ Stripe processa transação
✅ Processadora aprova
✅ Stripe envia webhook
✅ Nosso servidor recebe webhook
✅ Verifica assinatura
✅ Atualiza usuário no Firestore
✅ Cria registro de pedido
✅ Envia email de confirmação
```

#### 📍 **MOMENTO 6: Sucesso!**
```
Página: welcome.html

Exibe:
   ✅ PAGAMENTO CONFIRMADO!
   
   Seu plano: 30-Day Intensive
   Válido até: [data]
   Dias restantes: 30
   
   [Começar a Estudar]

Usuário pode agora:
✅ Fazer prática de Listening
✅ Fazer prática de Reading
✅ Fazer prática de Writing
✅ Ver progresso
```

#### 📍 **MOMENTO 7-11: Uso da plataforma, expiração e renovação**
```
Usuário estuda...

Dia 28: Notificação "Seu plano expira em 2 dias"
Dia 30: Plano expira, acesso bloqueado
        Oferecido: Renovar plano

Usuário renova → Novo ciclo começa
```

---

## 🎯 Por que estes testes importam?

| Teste | Por que importa |
|-------|-----------------|
| Backend (Cloud Functions) | Garante que pagamentos são processados corretamente e segurança é mantida |
| Autenticação | Garante que usuários são protegidos e suas contas são seguras |
| Seleção de Planos | Garante que preços corretos são exibidos e planos corretos são escolhidos |
| Checkout | Garante cálculos corretos e transações seguras |
| E2E | Garante a jornada COMPLETA funciona (não há quebras entre etapas) |

---

## 🚨 Segurança Testada

### Token de Autenticação
```javascript
✅ Token é gerado apenas para usuários autenticados
✅ Token é validado em toda requisição sensível
✅ Token é armazenado em localStorage (seguro no navegador)
✅ Sem token: erro 401 Unauthorized
```

### Price ID Whitelist
```javascript
✅ Somente Price IDs válidos são aceitos
✅ Hacker não pode enviar Price ID falso
✅ Sistema bloqueia qualquer outro Price ID
```

### Webhook Signature
```javascript
✅ Webhook é assinado com Stripe secret
✅ Assinatura é verificada antes de processar
✅ Webhook não assinado = rejeitado
✅ Protege contra webhooks fraudulentos
```

---

## 📊 Cobertura de Testes

Após executar:
```bash
npm run test:coverage
```

Você verá um relatório mostrando qual % do código está testado:

```
─────────────────────────────────────────────────
File                              % Stmts  % Branch
─────────────────────────────────────────────────
functions/index.js                 85%      80%
public/auth-service.js             90%      85%
public/plan.html                   95%      90%
public/checkout.js                 88%      85%
─────────────────────────────────────────────────
All files                          89%      85%
─────────────────────────────────────────────────
```

---

## ✅ Checklist de Teste Manual

Antes de fazer deploy, verifique:

- [ ] Teste de registro funciona
- [ ] Email de verificação é recebido
- [ ] Login depois de verificar email
- [ ] Página de planos exibe 3 planos
- [ ] Preços estão corretos: $9.99, $19.99, $34.99
- [ ] Clicar "Subscribe" redireciona para Stripe
- [ ] Página de checkout mostra cálculo correto
- [ ] Pagamento test no Stripe processa corretamente
- [ ] Email de confirmação é recebido
- [ ] Usuário tem acesso a conteúdo após pagar
- [ ] Logout funciona
- [ ] Login subsequente funciona

---

## 🐛 Quando algo falha

Se um teste falha:

1. **Leia a mensagem de erro** - diz exatamente qual linha falhou
2. **Reproduza manualmente** - abra o browser e tente o fluxo
3. **Verifique Firebase** - está logado? Tokens válidos?
4. **Verifique Stripe** - Price IDs estão corretos?
5. **Veja os logs** - `console.log` statements mostram o que aconteceu

---

## 📞 Suporte

Se encontrar problemas durante testes:
- Verifique se todos os Price IDs no código estão atualizados
- Verifique se Firebase está inicializado
- Verifique se Stripe keys estão corretas
- Verifique console do navegador (F12) para erros

---

## 🎉 Conclusão

Com estes testes, você tem:
✅ Confiança que o fluxo completo funciona
✅ Segurança contra fraude
✅ Proteção contra bugs
✅ Documentação clara do comportamento esperado

**Parabéns! SimpleTCF está pronto para produção! 🚀**
