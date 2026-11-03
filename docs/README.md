# Documentação — Dash cvi

Referência técnica dos módulos e integrações do dashboard.

## 📚 Índice

### Autenticação & Autorização
- **[Usuários, Papéis e Auditoria](usuarios-papeis-e-auditoria.md)** — Estrutura de roles, matriz de permissões, status operacional e auditoria
- **[Implementação de Hierarquia](implementacao-hierarquia-usuarios.md)** — Diagnóstico de escopo, decisões arquiteturais e riscos

### Configuração
- **[Configuração agnóstica do atendimento](configuracao-atendimento.md)** — Estados, notificações, tipos de agendamento e agendas configuráveis pelo painel
- **[Implantar uma nova clínica](nova-clinica.md)** — Ordem de implantação, variáveis por clínica, testes, premissas e limites
- **[Cobertura do prompt do n8n](prompt-n8n-cobertura.md)** — Destino de cada regra, seção e nó do fluxo original, e decisões pendentes da clínica

### Automações (n8n)
- **[Lembretes](lembretes-n8n.md)** — Automação de lembretes de agendamento
- **[Mensagens Agendadas](mensagens-agendadas-n8n.md)** — Envio programado de mensagens

### Integrações Externas
- **[Google Calendar API v3](integracao-google-calendar.md)** — Integração direta, agendas dinâmicas, filtros clínicos e modo retrátil
- **[Pesquisas de Satisfação](pesquisas-satisfacao-google-forms.md)** — Integração com Google Forms
- **[Import/Export Planilhas](importacao-exportacao-planilhas.md)** — Fluxo operacional de dados
- **[Arquivos das Conversas](arquivos-conversas-uazapi.md)** — Catálogo e cópia permanente das mídias da Uazapi

---

## 🗂️ Estrutura de Migrações

Migrações SQL em `supabase/migrations/`:

- **20260709** — Base: clientes, conversas, pendências, tags
- **20260716** — Busca, status de conversas, pesquisas, mensagens agendadas, lembretes
- **20260717** — Status de conversas, reabertura automática
- **20260719** — Atendente + telefone
- **20260725** — Auth: perfis, papéis, status operacional, auditoria
- **20260727** — Usuários previstos
- **20260728** — Índices de clientes
- **20260806** — Atividade diária (rastreamento de tempo ativo)
- **20260814** — Eventos de status das conversas; catálogo de mídias das conversas

---

## 🔒 Verificações de RLS

Testes de Row Level Security em `supabase/tests/rls_verificacao.sql`

---

## 💡 Notas Importantes

- **Limite PostgREST:** 1000 linhas (mitigado com `fetchAllRows` em hooks)
- **Single-tenant:** Apenas clínica cvi (sem organização/RBAC dinâmico)
- **Aplicação de Migrations:** Manual via SQL Editor do Supabase
