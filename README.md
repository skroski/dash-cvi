# Dash CVI — Centro Veterinário Integrado Fazenda Rio Grande

Dashboard interno para gestão de atendimentos, clientes, consultas e equipe do C.V.I. - Centro Veterinário Integrado (Fazenda Rio Grande, PR). Assistente Virtual: Balthazar.

**Projeto:** Single-tenant React + Supabase  
**Status:** Em produção / desenvolvimento  
**Última atualização:** 2026-11-03

---

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Iniciar dev server (http://localhost:5173)
npm run dev

# Build para produção
npm run build
```

---

## 📁 Estrutura do Projeto

```
src/
├── components/        # UI por domínio (clientes, conversas, atendentes, etc)
├── pages/            # Rotas principais
├── hooks/            # React hooks customizados (métricas, atividade)
├── context/          # Estado global (Auth)
├── integrations/     # Cliente Supabase + tipos
├── lib/              # Utilitários (fetchAllRows, etc)
├── utils/            # Helpers
└── config/           # Configurações

supabase/
├── migrations/       # Versionamento de schema SQL
├── functions/        # Edge Functions (automações)
└── tests/            # Verificações RLS
```

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **UI:** shadcn/ui (Radix) + Tailwind CSS
- **State:** React Query, React Context
- **Database:** Supabase (PostgreSQL + RLS)
- **Charts:** Recharts
- **Forms:** react-hook-form + Zod
- **Toast:** Sonner

---

## 📋 Documentação

| Documento | Descrição |
|-----------|-----------|
| [Usuários, Papéis e Auditoria](docs/usuarios-papeis-e-auditoria.md) | Estrutura de auth, roles e permissions |
| [Implementação de Hierarquia](docs/implementacao-hierarquia-usuarios.md) | Diagnóstico e decisões arquiteturais |
| [Lembretes (n8n)](docs/lembretes-n8n.md) | Automação de lembretes de agendamento |
| [Mensagens Agendadas](docs/mensagens-agendadas-n8n.md) | Envio programado de mensagens |
| [Configuração do atendimento](docs/configuracao-atendimento.md) | Empresa, serviços, estados, agendas e prompt configuráveis |
| [Nova clínica](docs/nova-clinica.md) | Ordem de implantação, variáveis, testes e limites |
| [Cobertura do prompt do n8n](docs/prompt-n8n-cobertura.md) | Destino de cada regra do prompt original |
| [Pesquisas de Satisfação](docs/pesquisas-satisfacao-google-forms.md) | Integração Google Forms |
| [Import/Export de Planilhas](docs/importacao-exportacao-planilhas.md) | Fluxo de operacional |
| [Fila presencial](docs/fila-presencial.md) | Senha diária, TV com vídeos, totem, cupom e avisos por WhatsApp |

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um `.env.local`:

```env
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### Migrações SQL

Migrações ficam em `supabase/migrations/` e são aplicadas manualmente no **SQL Editor** do Supabase.

**Migrations pendentes (2026-08-06):**
- `20260725100000_perfis_papeis.sql`
- `20260725110000_auditoria.sql`
- `20260725120000_status_operacional.sql`
- `20260806100000_atividade_diaria.sql`

---

## 🔐 Segurança

- RLS (Row Level Security) habilitado em todas as tabelas
- Isolamento por `user_id` (single-tenant)
- Verificações de RLS em `supabase/tests/`

---

## 🚧 Desenvolvimento

### Commits Recentes
- `4c8f05b` — atualização das conversas
- `f04238d` — melhorias de scroll
- `d9e3b85` — ajuste de scroll e conversas fechadas
- `f6af584` — ajuste de fechamento e estado
- `79013a2` — ajustes de rolagem e status de fechamento

### Conhecidas
- **PostgREST:** Limite silencioso de 1000 linhas (mitigado com `fetchAllRows`)
- **Atividade Diária:** Rastreamento implementado, migration pendente

---

## 📝 Licença

VetBots © 2026
