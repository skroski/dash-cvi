import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Conversation } from '@/types/chat';
import { MessageTemplate, CustomMessageTemplateInput } from '@/types/messageTemplate';
import { useReminders } from '@/hooks/useReminders';
import { useSatisfactionSurveys } from '@/hooks/useSatisfactionSurveys';
import { DEFAULT_REMINDER_TEMPLATE } from '@/types/reminder';
import { DEFAULT_SATISFACTION_TEMPLATE } from '@/types/satisfaction';
import { fetchUazapiQuickReplies } from '@/services/uazapi';
import { toast } from 'sonner';

const LOCAL_STORAGE_KEY = 'custom_message_templates';

const PRESET_TEMPLATES: MessageTemplate[] = [
  {
    id: 'preset-boas-vindas',
    title: 'Boas-Vindas',
    shortcut: '/boasvindas',
    category: 'atendimento',
    content: 'Olá, {{nome_tutor}}! Como posso te ajudar hoje?',
    isDefault: true,
  },

  {
    id: 'preset-agendamento',
    title: 'Confirmação de Agendamento',
    shortcut: '/agendamento',
    category: 'atendimento',
    content: 'Olá, {{nome_tutor}}! Confirmamos o agendamento do(a) {{nome_pet}} para {{servico}}. Te esperamos!',
    isDefault: true,
  },
  {
    id: 'preset-cadastro',
    title: 'Solicitação de Dados / Cadastro',
    shortcut: '/cadastro',
    category: 'atendimento',
    content: 'Olá, {{nome_tutor}}! Para atualizar o cadastro do(a) {{nome_pet}}, por favor informe: Raça, Idade, Peso e Alergias.',
    isDefault: true,
  },
  {
    id: 'preset-pix',
    title: 'Chave PIX / Pagamento',
    shortcut: '/pix',
    category: 'atendimento',
    content: 'Olá, {{nome_tutor}}! Segue a nossa chave PIX para pagamento: [chave_pix]. Após realizar o envio, nos mande o comprovante por aqui!',
    isDefault: true,
  },
  {
    id: 'preset-horario',
    title: 'Horário de Funcionamento',
    shortcut: '/horario',
    category: 'atendimento',
    content: 'Nosso horário de funcionamento é de Segunda a Sexta das 08h às 18h e Sábados das 08h às 14h.',
    isDefault: true,
  },
  {
    id: 'preset-localizacao',
    title: 'Endereço & Localização',
    shortcut: '/endereco',
    category: 'atendimento',
    content: 'Ficamos localizados na [Endereço da Clínica/Petshop]. Aguardamos sua visita!',
    isDefault: true,
  },
  {
    id: 'preset-exame',
    title: 'Laudo / Exame Pronto',
    shortcut: '/exame',
    category: 'atendimento',
    content: 'Olá, {{nome_tutor}}! Os resultados do exame do(a) {{nome_pet}} já estão prontos. Seguem em anexo.',
    isDefault: true,
  },
  {
    id: 'preset-ausente',
    title: 'Aviso de Ausência',
    shortcut: '/ausente',
    category: 'atendimento',
    content: 'Olá! No momento estamos em atendimento presencial. Responderemos sua mensagem em breve.',
    isDefault: true,
  },
];

export function useMessageTemplates() {
  const { configurations: reminderConfigs } = useReminders();
  const { configurations: satisfactionConfigs } = useSatisfactionSurveys();

  // Busca modelos / respostas rápidas cadastrados no telefone via Uazapi
  const {
    data: uazapiQuickReplies = [],
    isLoading: isLoadingUazapi,
    refetch: refetchUazapi,
  } = useQuery({
    queryKey: ['uazapi-quick-replies'],
    queryFn: fetchUazapiQuickReplies,
    staleTime: 1000 * 60 * 5, // 5 minutos
    retry: 1,
  });

  const [customTemplates, setCustomTemplates] = useState<MessageTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customTemplates));
    } catch (e) {
      console.error('Erro ao salvar modelos personalizados no localStorage:', e);
    }
  }, [customTemplates]);

  const addCustomTemplate = useCallback((input: CustomMessageTemplateInput) => {
    const shortcutClean = input.shortcut.startsWith('/')
      ? input.shortcut.toLowerCase().trim()
      : `/${input.shortcut.toLowerCase().trim()}`;

    const newTemplate: MessageTemplate = {
      id: `custom-${Date.now()}`,
      title: input.title.trim(),
      shortcut: shortcutClean,
      category: 'personalizado',
      content: input.content.trim(),
    };

    setCustomTemplates((prev) => [newTemplate, ...prev]);
    toast.success('Modelo personalizado salvo!');
  }, []);

  const deleteCustomTemplate = useCallback((id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success('Modelo removido com sucesso');
  }, []);

  const allTemplates = useMemo<MessageTemplate[]>(() => {
    // Modelos que vieram diretamente do telefone / WhatsApp via Uazapi
    const uazapiTemplates: MessageTemplate[] = uazapiQuickReplies.map((qr) => ({
      id: qr.id,
      title: qr.title,
      shortcut: qr.shortcut,
      category: 'whatsapp',
      content: qr.text,
    }));

    const databaseReminderTemplates: MessageTemplate[] = (reminderConfigs || []).map((config) => ({
      id: `reminder-${config.id}`,
      title: `Lembrete: ${config.name}`,
      shortcut: `/lembrete-${config.id}`,
      category: 'lembrete',
      content: config.messageTemplate,
    }));

    if (databaseReminderTemplates.length === 0) {
      databaseReminderTemplates.push({
        id: 'default-reminder',
        title: 'Modelo de Lembrete Agendado',
        shortcut: '/lembrete',
        category: 'lembrete',
        content: DEFAULT_REMINDER_TEMPLATE,
      });
    }

    const databaseSatisfactionTemplates: MessageTemplate[] = (satisfactionConfigs || []).map((config) => ({
      id: `satisfaction-${config.id}`,
      title: `Pesquisa: ${config.name}`,
      shortcut: `/pesquisa-${config.id}`,
      category: 'pesquisa',
      content: config.messageTemplate,
    }));

    if (databaseSatisfactionTemplates.length === 0) {
      databaseSatisfactionTemplates.push({
        id: 'default-satisfaction',
        title: 'Modelo de Pesquisa de Satisfação',
        shortcut: '/pesquisa',
        category: 'pesquisa',
        content: DEFAULT_SATISFACTION_TEMPLATE,
      });
    }

    // Prioriza os modelos vindos do WhatsApp (Uazapi) em primeiro lugar
    return [
      ...uazapiTemplates,
      ...PRESET_TEMPLATES,
      ...customTemplates,
      ...databaseReminderTemplates,
      ...databaseSatisfactionTemplates,
    ];
  }, [uazapiQuickReplies, reminderConfigs, satisfactionConfigs, customTemplates]);

  const populateTemplate = useCallback((templateContent: string, conversation?: Conversation): string => {
    if (!templateContent) return '';

    const tutorName = conversation?.clientData?.nome || conversation?.name || '';
    const petName = conversation?.petName || '';
    const serviceName = conversation?.clientData?.servico || '';

    const now = new Date();
    const dataStr = now.toLocaleDateString('pt-BR');
    const horaStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let result = templateContent;

    if (tutorName) {
      result = result
        .replaceAll('{{nome_tutor}}', tutorName)
        .replaceAll('{{tutor}}', tutorName)
        .replaceAll('{{nome_cliente}}', tutorName)
        .replaceAll('{{cliente}}', tutorName);
    }

    if (petName) {
      result = result
        .replaceAll('{{nome_pet}}', petName)
        .replaceAll('{{pet}}', petName);
    }

    if (serviceName) {
      result = result.replaceAll('{{servico}}', serviceName);
    }

    result = result
      .replaceAll('{{data}}', dataStr)
      .replaceAll('{{horario}}', horaStr);

    return result;
  }, []);

  return {
    templates: allTemplates,
    uazapiCount: uazapiQuickReplies.length,
    isLoadingUazapi,
    refetchUazapi,
    customTemplates,
    addCustomTemplate,
    deleteCustomTemplate,
    populateTemplate,
  };
}
