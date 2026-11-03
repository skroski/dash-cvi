import React from 'react';
import { PawPrint, User, FileText, Download, ExternalLink, CheckCheck } from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { formatDayTime } from '@/lib/formatters';
import { inferMediaKind, rotuloDoFormato } from '@/lib/media';
import FormattedMessage from './FormattedMessage';

interface MessageItemProps {
  message: ChatMessage;
  index: number;
}

const MessageItem = ({ message, index }: MessageItemProps) => {
  if (!message.content && !message.mediaUrl) return null;

  // Determine if the message was sent by a human/client user
  const isHuman = message.role === 'human' || message.type === 'human';

  // Messages sent from the dashboard (staff/assistant) appear on the right
  const isDashboardSent = message.role === 'assistant' ||
                          message.type === 'ai' ||
                          (!isHuman && message.role !== 'human');

  const renderMedia = () => {
    if (!message.mediaUrl) return null;

    // O tipo sai de `type` + nome do arquivo + URL, nessa ordem: a URL que a
    // Uazapi hospeda quase nunca tem extensão, e o `type` às vezes carrega o
    // papel de quem falou ('human') em vez do formato. Ver src/lib/media.ts.
    const kind = inferMediaKind(message);

    if (kind === 'image') {
      return (
        <div className="group relative mb-2 overflow-hidden rounded-lg border bg-muted">
          <img
            src={message.mediaUrl}
            alt={message.content || "Imagem recebida"}
            className="h-auto max-h-72 max-w-full cursor-pointer object-contain transition-transform hover:scale-[1.02]"
            onClick={() => window.open(message.mediaUrl, '_blank')}
          />
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Abrir imagem em nova guia"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      );
    }

    if (kind === 'video') {
      return (
        <div className="mb-2 overflow-hidden rounded-lg border bg-black">
          <video
            src={message.mediaUrl}
            controls
            preload="metadata"
            className="max-h-72 w-full max-w-full"
          />
        </div>
      );
    }

    if (kind === 'audio') {
      return (
        <div className="mb-2 rounded-lg bg-black/5 p-1 dark:bg-black/20">
          {message.fileName && (
            <p className={`truncate px-2 pb-0.5 pt-1 text-xs font-medium ${
              isDashboardSent ? 'text-primary-foreground/90' : 'text-muted-foreground'
            }`}>
              {message.fileName.replace(/\.(webm|mp3|ogg|wav|m4a)$/i, '')}
            </p>
          )}
          <audio
            src={message.mediaUrl}
            controls
            className={`h-9 w-full max-w-[240px] md:max-w-[280px] ${
              isDashboardSent ? 'invert brightness-200 filter' : ''
            }`}
          />
        </div>
      );
    }

    // Documento ou formato não identificado. O rótulo vem do arquivo de
    // verdade — dizer "PDF" para todo anexo desconhecido induzia a equipe a
    // erro sobre o que estava recebendo.
    return (
      <div className={`mb-2 flex items-center gap-3 rounded-lg border p-2.5 ${
        isDashboardSent
          ? 'border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground'
          : 'border-border bg-card text-card-foreground'
      }`}>
        <div className={`rounded p-2 ${
          isDashboardSent ? 'bg-primary-foreground/20' : 'bg-destructive/10 text-destructive'
        }`}>
          <FileText size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {message.fileName || 'Arquivo'}
          </p>
          <p className="text-xs opacity-75">{rotuloDoFormato(message)}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-full p-1.5 transition-colors ${
              isDashboardSent ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted'
            }`}
            aria-label={`Abrir ${message.fileName || 'arquivo'} em nova guia`}
          >
            <ExternalLink size={16} />
          </a>
          <a
            href={message.mediaUrl}
            download={message.fileName || 'arquivo'}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-full p-1.5 transition-colors ${
              isDashboardSent ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted'
            }`}
            aria-label={`Baixar ${message.fileName || 'arquivo'}`}
          >
            <Download size={16} />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div
      key={`message-${index}`}
      className={`flex ${isDashboardSent ? 'justify-end' : 'justify-start'}`}
    >
      {!isDashboardSent && (
        <div className="mb-1 mr-2 flex h-8 w-8 items-center justify-center self-end rounded-full bg-muted shadow-xs" aria-hidden="true">
          <User size={16} className="text-muted-foreground" />
        </div>
      )}

      <div
        className={`max-w-[85%] p-3 shadow-xs md:max-w-[70%] ${
          !isDashboardSent
            ? 'rounded-2xl rounded-tl-xs border bg-card text-card-foreground'
            : 'rounded-2xl rounded-tr-xs bg-primary text-primary-foreground'
        }`}
      >
        {/* Remetente em mensagens recebidas de grupos */}
        {!isDashboardSent && message.senderName && (
          <p className="mb-1 text-xs font-semibold text-primary">
            {message.senderName}
          </p>
        )}

        {renderMedia()}

        {message.content && (
          <FormattedMessage
            content={message.content}
            isDashboardSent={isDashboardSent}
          />
        )}

        <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
          !isDashboardSent
            ? 'text-muted-foreground'
            : 'text-primary-foreground/75'
        }`}>
          <span>{formatDayTime(message.timestamp)}</span>
          {isDashboardSent && (
            <CheckCheck className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
          )}
        </div>
      </div>

      {isDashboardSent && (
        <div className="mb-1 ml-2 flex h-8 w-8 items-center justify-center self-end rounded-full border border-primary/20 bg-accent shadow-xs" aria-hidden="true">
          <PawPrint size={16} className="text-accent-foreground" />
        </div>
      )}
    </div>
  );
};

export default MessageItem;

