import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, Code2, Phone, User, Sparkles, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ChatWebSearchResult } from '@/services/chatWebSearch';
import { useChatMessages } from '@/hooks/useChatMessages';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import { formatPhone } from '@/lib/formatters';

interface ChatWebSessionViewProps {
  session: ChatWebSearchResult;
  onBack: () => void;
}

export const ChatWebSessionView: React.FC<ChatWebSessionViewProps> = ({ session, onBack }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Reaproveita a engine nativa de mensagens e realtime do sistema de conversas
  const { messages, loading, handleNewMessage } = useChatMessages(
    session.sessionId,
    session.phone
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(session.code);
    setCopiedCode(true);
    toast.success('Código copiado!', {
      description: `Código ${session.code} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const embedUrl = `${window.location.origin}/web-chat?code=${encodeURIComponent(session.code)}`;
  const embedCodeSnippet = `<!-- Widget ChatWeb Clínico -->
<iframe
  src="${embedUrl}"
  width="420"
  height="680"
  style="border: none; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);"
  title="ChatWeb Clínico"
></iframe>`;

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCodeSnippet);
    setCopiedEmbed(true);
    toast.success('Código de incorporação copiado!');
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Barra Superior com Código ChatWeb e Dados do Tutor */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>

          <div className="h-5 w-px bg-border/60" />

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                {session.name}
              </span>
              {session.petName && (
                <Badge variant="secondary" className="text-[11px] font-normal">
                  Pet: {session.petName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="h-3 w-3" />
                {formatPhone(session.phone)}
              </span>
              <span>•</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Conectado ao WhatsApp
              </span>
            </div>
          </div>
        </div>

        {/* Badge do Código ChatWeb com Ações */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-background/80 px-2.5 py-1 text-xs shadow-sm">
            <span className="text-muted-foreground text-[11px]">Código:</span>
            <span className="font-mono font-bold tracking-wider text-primary">
              {session.code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1 hover:bg-muted"
              onClick={handleCopyCode}
              title="Copiar código"
            >
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>

          {/* Modal para Visualizar e Copiar Código de Incorporação */}
          <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Código Embed</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" />
                  Código de Incorporação do ChatWeb
                </DialogTitle>
                <DialogDescription>
                  Incorpore esta sessão do ChatWeb no site da clínica ou portal externo.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Link Direto da Conversa:
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={embedUrl}
                      className="w-full rounded-md border bg-muted/40 px-3 py-1.5 text-xs font-mono select-all"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(embedUrl);
                        toast.success('Link copiado!');
                      }}
                    >
                      Copiar Link
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Código HTML do Iframe:
                  </label>
                  <Textarea
                    readOnly
                    value={embedCodeSnippet}
                    rows={6}
                    className="font-mono text-xs select-all bg-muted/40 resize-none"
                  />
                </div>

                <Button
                  onClick={handleCopyEmbed}
                  className="w-full gap-2 font-medium"
                >
                  {copiedEmbed ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-300" />
                      Código de Incorporação Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar Snippet Iframe
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Área de Mensagens (100% reutilizando MessageList do sistema de conversas) */}
      <div className="min-h-0 flex-1 bg-background/50">
        <MessageList
          conversationId={session.sessionId}
          messages={messages}
          loading={loading}
        />
      </div>

      {/* Área de Envio (100% reutilizando MessageInput do sistema de conversas) */}
      <div className="border-t bg-card">
        <MessageInput
          selectedChat={session.sessionId}
          selectedConversation={session.conversation}
          onNewMessage={handleNewMessage}
        />
      </div>
    </div>
  );
};
