import { Link } from 'react-router-dom';
import { CalendarClock, Database, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OpenAIKeyCard } from '@/components/config/OpenAIKeyCard';
import { BlacklistCard } from '@/components/config/BlacklistCard';

const ConfigurationManager = () => (
  <PageContainer>
    <div className="mb-8 max-w-3xl">
      <Badge variant="outline" className="mb-3 gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Configuração segura</Badge>
      <h1 className="text-3xl font-semibold tracking-tight">Integrações do sistema</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        As credenciais e integrações do sistema são protegidas com criptografia no Supabase Vault. Apenas administradores podem atualizar as chaves de API.
      </p>
    </div>

    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {/* Card de Bloqueio de Números / Blacklist */}
      <BlacklistCard />

      {/* Card Seguro da Chave da OpenAI */}
      <OpenAIKeyCard />

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1">
            <MessageCircle className="h-5 w-5" />
          </div>
          <CardTitle className="text-base font-semibold">WhatsApp (UAZAPI)</CardTitle>
          <CardDescription className="text-xs">Envios, grupos, mídia e histórico de atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-xs text-muted-foreground">
            Instância e tokens da UAZAPI são protegidos no backend.
          </p>
          <Button asChild variant="outline" size="sm" className="w-full text-xs h-8">
            <Link to="/uazapi">Conexão WhatsApp</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Agenda clínica - temporariamente desabilitada */}
      {/* <Card>
        <CardHeader>
          <div className="p-2 w-fit rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-1">
            <CalendarClock className="h-5 w-5" />
          </div>
          <CardTitle className="text-base font-semibold">Agenda clínica</CardTitle>
          <CardDescription className="text-xs">Profissionais, especialidades, turnos e bloqueios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-xs text-muted-foreground">
            Regras auditadas diretamente com o Google Calendar.
          </p>
          <Button asChild variant="outline" size="sm" className="w-full text-xs h-8">
            <Link to="/agenda-configuracao">Abrir regras da agenda</Link>
          </Button>
        </CardContent>
      </Card> */}

      {/* Prompt do assistente */}
      <Card>
        <CardHeader>
          <div className="p-2 w-fit rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 mb-1">
            <Sparkles className="h-5 w-5" />
          </div>
          <CardTitle className="text-base font-semibold">Prompt do assistente</CardTitle>
          <CardDescription className="text-xs">Instruções comportamentais da assistente virtual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-xs text-muted-foreground">
            Versões auditadas com histórico completo de alterações.
          </p>
          <Button asChild variant="outline" size="sm" className="w-full text-xs h-8">
            <Link to="/my-prompt">Editar Meu Prompt</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  </PageContainer>
);

export default ConfigurationManager;

