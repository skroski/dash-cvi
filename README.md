# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/3b798310-9314-49a9-9604-c5927962c5fd

## Documentação

Documentação técnica dos módulos do painel, em `docs/`:

| Documento | Assunto |
|---|---|
| [Usuários, papéis, status e auditoria](docs/usuarios-papeis-e-auditoria.md) | Referência de uso: papéis, matriz de permissões, status operacional, auditoria e ordem das migrations |
| [Registro da implementação de hierarquia](docs/implementacao-hierarquia-usuarios.md) | Diagnóstico inicial, decisões de escopo, verificação executada e riscos |
| [Lembretes (n8n)](docs/lembretes-n8n.md) | Lembretes de agendamento |
| [Mensagens agendadas (n8n)](docs/mensagens-agendadas-n8n.md) | Envio de mensagens avulsas programadas |
| [Pesquisas de satisfação](docs/pesquisas-satisfacao-google-forms.md) | Integração com Google Forms |
| [Importação e exportação de planilhas](docs/importacao-exportacao-planilhas.md) | Fluxo operacional por planilha |

Migrations SQL ficam em `supabase/migrations/` e são aplicadas manualmente no SQL
Editor do Supabase. Verificações de RLS em `supabase/tests/`.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/3b798310-9314-49a9-9604-c5927962c5fd) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with .

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/3b798310-9314-49a9-9604-c5927962c5fd) and click on Share -> Publish.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
