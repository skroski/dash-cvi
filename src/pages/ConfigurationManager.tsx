
import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';
import { ENV_DEFAULTS } from '@/config/env';

// Default webhook base URL
const DEFAULT_WEBHOOK_BASE = ENV_DEFAULTS.WEBHOOK_BASE_URL;

// Default endpoints configuration
const defaultEndpoints = {
  webhookBaseUrl: DEFAULT_WEBHOOK_BASE,
  mensagem: `${DEFAULT_WEBHOOK_BASE}/envia_mensagem`,
  pausaBot: `${DEFAULT_WEBHOOK_BASE}/pausa_bot`,
  iniciaBot: `${DEFAULT_WEBHOOK_BASE}/ix`,

  agendaVet: `${DEFAULT_WEBHOOK_BASE}/agenda/consultaveterinaria`,
  agendaAdicionarVet: `${DEFAULT_WEBHOOK_BASE}/agenda/adicionar/consultaveterinaria`,
  agendaAlterarVet: `${DEFAULT_WEBHOOK_BASE}/agenda/alterar/consultaveterinaria`,
  agendaExcluirVet: `${DEFAULT_WEBHOOK_BASE}/agenda/excluir/consultaveterinaria`,

  agendaVacinas: `${DEFAULT_WEBHOOK_BASE}/agenda/vacinas`,
  agendaAdicionarVacinas: `${DEFAULT_WEBHOOK_BASE}/agenda/adicionar/vacinas`,
  agendaAlterarVacinas: `${DEFAULT_WEBHOOK_BASE}/agenda/alterar/vacinas`,
  agendaExcluirVacinas: `${DEFAULT_WEBHOOK_BASE}/agenda/excluir/vacinas`,

  agendaExame: `${DEFAULT_WEBHOOK_BASE}/agenda/exame`,
  agendaAdicionarExame: `${DEFAULT_WEBHOOK_BASE}/agenda/adicionar/exame`,
  agendaAlterarExame: `${DEFAULT_WEBHOOK_BASE}/agenda/alterar/exame`,
  agendaExcluirExame: `${DEFAULT_WEBHOOK_BASE}/agenda/excluir/exame`,

  agendaHotel: `${DEFAULT_WEBHOOK_BASE}/agenda/hotel`,
  agendaAdicionarHotel: `${DEFAULT_WEBHOOK_BASE}/agenda/adicionar/hotel`,
  agendaAlterarHotel: `${DEFAULT_WEBHOOK_BASE}/agenda/alterar/hotel`,
  agendaExcluirHotel: `${DEFAULT_WEBHOOK_BASE}/agenda/excluir/hotel`,
  
  enviaRag: `${DEFAULT_WEBHOOK_BASE}/envia_rag`,
  excluirArquivoRag: `${DEFAULT_WEBHOOK_BASE}/excluir-arquivo-rag`,
  excluirRag: `${DEFAULT_WEBHOOK_BASE}/excluir-rag`,
  instanciaEvolution: `${DEFAULT_WEBHOOK_BASE}/instanciaevolution`,
  atualizarQrCode: `${DEFAULT_WEBHOOK_BASE}/atualizar-qr-code`,
  confirma: `${DEFAULT_WEBHOOK_BASE}/confirma`,
  uazapiServerUrl: ENV_DEFAULTS.UAZAPI_SERVER_URL,
  uazapiInstanceToken: ENV_DEFAULTS.UAZAPI_INSTANCE_TOKEN,
  uazapiAdminToken: ENV_DEFAULTS.UAZAPI_ADMIN_TOKEN,
};

const endpointGroups = {
  'Configurações Gerais': [
    { id: 'webhookBaseUrl', label: 'URL Base do Webhook', key: 'webhookBaseUrl' }
  ],
  'Configuração Supabase': [
    { id: 'supabaseUrl', label: 'URL do Supabase', value: ENV_DEFAULTS.SUPABASE_URL, readOnly: true },
    { id: 'supabaseKey', label: 'Chave Anônima do Supabase', value: ENV_DEFAULTS.SUPABASE_ANON_KEY, readOnly: true }
  ],
  'Configuração UAZAPI': [
    { id: 'uazapiServerUrl', label: 'URL do Servidor UAZAPI', key: 'uazapiServerUrl' },
    { id: 'uazapiInstanceToken', label: 'Token da Instância UAZAPI', key: 'uazapiInstanceToken' },
    { id: 'uazapiAdminToken', label: 'Token de Administrador UAZAPI', key: 'uazapiAdminToken' }
  ],
  'Configuração da Agenda': [
    { id: 'agendaVet', label: 'URL Agenda Veterinário', key: 'agendaVet' },
    { id: 'agendaVacinas', label: 'URL Agenda Vacinas', key: 'agendaVacinas' },
    { id: 'agendaExame', label: 'URL Agenda Exame', key: 'agendaExame' },
    { id: 'agendaHotel', label: 'URL Agenda Hotel', key: 'agendaHotel' },

    { id: 'agendaAdicionarVet', label: 'Adicionar Evento Veterinário', key: 'agendaAdicionarVet' },
    { id: 'agendaAdicionarVacinas', label: 'Adicionar Evento Vacinas', key: 'agendaAdicionarVacinas' },
    { id: 'agendaAdicionarExame', label: 'Adicionar Evento Exame', key: 'agendaAdicionarExame' },
    { id: 'agendaAdicionarHotel', label: 'Adicionar Evento Hotel', key: 'agendaAdicionarHotel' },
    
    { id: 'agendaAlterarVet', label: 'Alterar Evento Veterinário', key: 'agendaAlterarVet' },
    { id: 'agendaAlterarVacinas', label: 'Alterar Evento Vacinas', key: 'agendaAlterarVacinas' },
    { id: 'agendaAlterarExame', label: 'Alterar Evento Exame', key: 'agendaAlterarExame' },
    { id: 'agendaAlterarHotel', label: 'Alterar Evento Hotel', key: 'agendaAlterarHotel' },

    { id: 'agendaExcluirVet', label: 'Excluir Evento Veterinário', key: 'agendaExcluirVet' },
    { id: 'agendaExcluirVacinas', label: 'Excluir Evento Vacinas', key: 'agendaExcluirVacinas' },
    { id: 'agendaExcluirExame', label: 'Excluir Evento Exame', key: 'agendaExcluirExame' },
    { id: 'agendaExcluirHotel', label: 'Excluir Evento Hotel', key: 'agendaExcluirHotel' }
  ],
  'Configuração do Bot': [
    { id: 'mensagem', label: 'Enviar Mensagem', key: 'mensagem' },
    { id: 'pausaBot', label: 'Pausar Bot', key: 'pausaBot' },
    { id: 'iniciaBot', label: 'Iniciar Bot', key: 'iniciaBot' },
    { id: 'confirma', label: 'Confirmar', key: 'confirma' }
  ],
  'Configuração RAG': [
    { id: 'enviaRag', label: 'Enviar RAG', key: 'enviaRag' },
    { id: 'excluirArquivoRag', label: 'Excluir Arquivo RAG', key: 'excluirArquivoRag' },
    { id: 'excluirRag', label: 'Excluir RAG', key: 'excluirRag' }
  ],
  'Configuração Evolution': [
    { id: 'instanciaEvolution', label: 'Instância Evolution', key: 'instanciaEvolution' },
    { id: 'atualizarQrCode', label: 'Atualizar QR Code', key: 'atualizarQrCode' }
  ]
};

const ConfigurationManager = () => {
  const [endpoints, setEndpoints] = React.useState(() => {
    const savedEndpoints = localStorage.getItem('webhookEndpoints');
    return savedEndpoints ? JSON.parse(savedEndpoints) : defaultEndpoints;
  });
  
  const handleEndpointChange = (key: string, value: string) => {
    setEndpoints(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('webhookEndpoints', JSON.stringify(endpoints));
    toast.success("Configurações salvas", { description: "As configurações foram salvas com sucesso." });
  };

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Endpoints e integrações usados pelo sistema. As alterações são salvas neste navegador.
        </p>
        <Button onClick={handleSave}>
          Salvar Alterações
        </Button>
      </div>

      <Card className="shadow-sm">
        <Accordion type="multiple" defaultValue={['Configurações Gerais']} className="px-4">
          {Object.entries(endpointGroups).map(([groupTitle, fields]) => (
            <AccordionItem key={groupTitle} value={groupTitle}>
              <AccordionTrigger className="text-base font-semibold hover:no-underline">
                <span className="flex items-center gap-2">
                  {groupTitle}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({fields.length} {fields.length === 1 ? 'campo' : 'campos'})
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 px-1 pb-2">
                  {fields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <Input
                        id={field.id}
                        value={field.readOnly ? field.value : endpoints[field.key as keyof typeof endpoints]}
                        onChange={field.readOnly ? undefined : (e) => handleEndpointChange(field.key, e.target.value)}
                        readOnly={field.readOnly}
                        className="w-full font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </PageContainer>
  );
};

export default ConfigurationManager;
