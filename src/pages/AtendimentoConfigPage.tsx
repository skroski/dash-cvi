import { useState } from 'react';
import { Bell, Building2, ClipboardCheck, Receipt, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DestinatariosCard } from '@/components/config/atendimento/DestinatariosCard';
import { EmpresaCard } from '@/components/config/atendimento/EmpresaCard';
import { EstadosCard } from '@/components/config/atendimento/EstadosCard';
import { ImplantacaoCard } from '@/components/config/atendimento/ImplantacaoCard';
import { ServicosCard } from '@/components/config/atendimento/ServicosCard';
import { useAtendimentoConfig } from '@/hooks/useAtendimentoConfig';

export default function AtendimentoConfigPage() {
  const dados = useAtendimentoConfig();
  const [aba, setAba] = useState('implantacao');

  if (dados.loading) {
    return <PageContainer><p className="text-sm text-muted-foreground">Carregando configuração do atendimento…</p></PageContainer>;
  }
  if (dados.error || !dados.config) {
    return (
      <PageContainer>
        <p className="text-sm text-destructive">
          Não foi possível carregar a configuração. Verifique se as migrações <code>20261026100000_configuracao_atendimento_agnostica</code> e{' '}
          <code>20261027100000_clinica_configuracao_prompt</code> foram aplicadas e se você é administrador.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">Configuração do atendimento</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tudo o que muda de cliente para cliente fica aqui, sem alterar código: empresa, serviços e valores, estados do atendimento, quem é avisado, e (em Regras da agenda) profissionais, agendas e tipos de agendamento.
          </p>
        </div>
        <div className="flex gap-2">
          {/* <Button asChild variant="outline" size="sm"><Link to="/agenda-configuracao">Regras da agenda</Link></Button> */}
          <Button asChild variant="outline" size="sm"><Link to="/my-prompt">Meu Prompt</Link></Button>
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="implantacao"><ClipboardCheck className="mr-1.5 h-4 w-4" /> Implantação</TabsTrigger>
          <TabsTrigger value="empresa"><Building2 className="mr-1.5 h-4 w-4" /> Empresa</TabsTrigger>
          <TabsTrigger value="servicos"><Receipt className="mr-1.5 h-4 w-4" /> Serviços e valores</TabsTrigger>
          <TabsTrigger value="estados"><Workflow className="mr-1.5 h-4 w-4" /> Estados</TabsTrigger>
          <TabsTrigger value="notificacoes"><Bell className="mr-1.5 h-4 w-4" /> Notificações</TabsTrigger>
        </TabsList>
        <TabsContent value="implantacao">
          <ImplantacaoCard
            config={dados.config}
            servicos={dados.servicos ?? []}
            destinatarios={dados.destinatarios ?? []}
            tipos={dados.tipos ?? []}
            onAbrirAba={setAba}
          />
        </TabsContent>
        <TabsContent value="empresa">
          <EmpresaCard config={dados.config} salvando={dados.salvarConfig.isPending} onSalvar={(v) => dados.salvarConfig.mutateAsync(v)} />
        </TabsContent>
        <TabsContent value="servicos">
          <ServicosCard
            servicos={dados.servicos ?? []}
            tipos={dados.tipos ?? []}
            disponivel={dados.servicosDisponivel ?? false}
            onSalvar={(v) => dados.salvarServico.mutateAsync(v)}
            onRemover={(id) => dados.removerServico.mutateAsync(id)}
          />
        </TabsContent>
        <TabsContent value="estados">
          <EstadosCard
            estados={dados.estados ?? []}
            onSalvar={(v) => dados.salvarEstado.mutateAsync(v)}
            onRemover={(id) => dados.removerEstado.mutateAsync(id)}
            onTestar={(entrada) => dados.testarClassificacao.mutateAsync(entrada)}
          />
        </TabsContent>
        <TabsContent value="notificacoes">
          <DestinatariosCard
            destinatarios={dados.destinatarios ?? []}
            estados={dados.estados ?? []}
            profissionais={dados.profissionais ?? []}
            departamentos={dados.departamentos ?? []}
            codigoPais={dados.config.codigo_pais}
            onSalvar={(v) => dados.salvarDestinatario.mutateAsync(v)}
            onRemover={(id) => dados.removerDestinatario.mutateAsync(id)}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
