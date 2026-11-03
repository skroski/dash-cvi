import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/shared/PageHeader';
import { ChatWebForm } from '@/components/chat-web/ChatWebForm';
import { ChatWebSessionView } from '@/components/chat-web/ChatWebSessionView';
import {
  ChatWebSearchResult,
  searchConversationByCode,
  searchConversationByPhoneAndFirstName,
} from '@/services/chatWebSearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatPhone } from '@/lib/formatters';

interface RecentSessionRow {
  id: string;
  codigo: string | null;
  nome_tutor: string;
  telefone: string | null;
  nome_pet: string | null;
  updated_at: string;
}

export default function WebChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<ChatWebSearchResult | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSessionRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  // Carregar sessões recentes salvas no chat_web_conversas
  const loadRecentSessions = async () => {
    setLoadingRecent(true);
    try {
      const { data, error } = await (supabase as any)
        .from('chat_web_conversas')
        .select('id, codigo, nome_tutor, telefone, nome_pet, updated_at')
        .order('updated_at', { ascending: false })
        .limit(8);

      if (!error && data) {
        setRecentSessions(data as RecentSessionRow[]);
      }
    } catch (err) {
      console.warn('Erro ao carregar sessões recentes do ChatWeb:', err);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadRecentSessions();
  }, []);

  // Lidar com parâmetros da URL (?code=... ou ?phone=...&name=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get('code');
    const phoneParam = params.get('phone');
    const nameParam = params.get('name');

    if (codeParam && !activeSession) {
      setAutoLoading(true);
      searchConversationByCode(codeParam)
        .then((res) => {
          if (res) setActiveSession(res);
        })
        .finally(() => setAutoLoading(false));
    } else if (phoneParam && nameParam && !activeSession) {
      setAutoLoading(true);
      searchConversationByPhoneAndFirstName(phoneParam, nameParam)
        .then((res) => {
          if (res) setActiveSession(res);
        })
        .finally(() => setAutoLoading(false));
    }
  }, [location.search]);

  const handleStartSession = (session: ChatWebSearchResult) => {
    setActiveSession(session);
    // Atualiza a URL sem recarregar a tela para facilitar compartilhamento do código
    navigate(`/web-chat?code=${encodeURIComponent(session.code)}`, { replace: true });
    loadRecentSessions();
  };

  const handleBackToForm = () => {
    setActiveSession(null);
    navigate('/web-chat', { replace: true });
    loadRecentSessions();
  };

  const handleSelectRecent = async (row: RecentSessionRow) => {
    if (row.codigo) {
      setAutoLoading(true);
      try {
        const res = await searchConversationByCode(row.codigo);
        if (res) {
          handleStartSession(res);
          return;
        }
      } catch (e) {
        console.error(e);
      } finally {
        setAutoLoading(false);
      }
    }

    if (row.telefone) {
      setAutoLoading(true);
      try {
        const firstName = row.nome_tutor.split(' ')[0] || '';
        const res = await searchConversationByPhoneAndFirstName(row.telefone, firstName);
        handleStartSession(res);
      } finally {
        setAutoLoading(false);
      }
    }
  };

  return (
    <PageContainer className="flex h-[calc(100vh-4rem)] min-h-[620px] flex-col pb-4">
      <PageHeader
        title="Chat Web"
        description="Atendimento com identificação por código, busca por telefone e primeiro nome no WhatsApp."
      />

      <div className="min-h-0 flex-1">
        {autoLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Carregando conversa do ChatWeb...</p>
            </div>
          </div>
        ) : activeSession ? (
          /* Conversa ativa: reaproveita MessageList e MessageInput integrados */
          <ChatWebSessionView
            session={activeSession}
            onBack={handleBackToForm}
          />
        ) : (
          /* Estado inicial: micro formulário e histórico de códigos recentes */
          <div className="grid h-full min-h-0 grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px] overflow-y-auto pb-4">
            <div className="flex items-center justify-center py-6" data-tour="webchat-form">
              <ChatWebForm onStartSession={handleStartSession} />
            </div>

            {/* Painel lateral: Atendimentos Recentes do ChatWeb */}
            <div className="space-y-4" data-tour="webchat-recents">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    Atendimentos ChatWeb Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[380px] px-4 pb-4">
                    {loadingRecent ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Carregando sessões...
                      </div>
                    ) : recentSessions.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Nenhum atendimento iniciado ainda. Preencha o micro formulário para começar.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recentSessions.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => handleSelectRecent(r)}
                            className="group flex cursor-pointer items-center justify-between rounded-lg border border-border/50 bg-background/50 p-2.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-foreground truncate">
                                  {r.nome_tutor}
                                </span>
                                {r.codigo && (
                                  <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                                    {r.codigo}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                {r.telefone && <span>{formatPhone(r.telefone)}</span>}
                                {r.nome_pet && <span>• Pet: {r.nome_pet}</span>}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground group-hover:text-primary"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
