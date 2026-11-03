import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageTemplatesPopover } from './MessageTemplatesPopover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Conversation, ChatMessage } from '@/types/chat';
import { toast } from 'sonner';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAtendenteAtivo } from '@/context/AtendenteAtivoContext';
import { buildChatId, sendMedia, sendText } from '@/services/uazapi';
import { extrairMessageId, registrarMidiaEnviada, TipoMidia } from '@/services/conversaMidias';
import { FileText, Loader2, Megaphone, MessageSquareQuote, Mic, Paperclip, Send, Square, Trash2, UploadCloud } from 'lucide-react';

interface MessageInputProps {
  selectedChat: string | null;
  selectedConversation?: Conversation;
  onNewMessage?: (message: ChatMessage) => void;
}

const removeAccents = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const sanitizeName = (name: string) => {
  return removeAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const getFormattedDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MessageInput = ({ selectedChat, selectedConversation, onNewMessage }: MessageInputProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedAtendente, setSelectedAtendente] = useState<string>('none');
  const { atendentes } = useAtendentes();
  const { atendenteAtivo } = useAtendenteAtivo();
  const atendentesAtivos = atendentes.filter((a) => a.ativo);
  const atendenteAtivoNome = atendenteAtivo?.nome ?? null;

  // Com atendente ativo escolhido no header, o chat já assina por ele;
  // sem atendente ativo, mantém a última escolha manual deste input
  useEffect(() => {
    if (atendenteAtivoNome) {
      setSelectedAtendente(atendenteAtivoNome);
      return;
    }
    const saved = localStorage.getItem('selectedAtendente');
    setSelectedAtendente(saved || 'none');
  }, [atendenteAtivoNome]);

  const handleAtendenteChange = (value: string) => {
    setSelectedAtendente(value);
    if (value !== 'none') {
      localStorage.setItem('selectedAtendente', value);
    } else {
      localStorage.removeItem('selectedAtendente');
    }
  };

  // Grupos são atendidos direto pela Uazapi (os webhooks do n8n são por cliente)
  const isGroup = !!selectedConversation?.isGroup;

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  // Nome editável do anexo (áudio/documento) — vira o fileName enviado e exibido no chat
  const [mediaName, setMediaName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Message templates (Slash commands / Modelos) states
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    // Max 15MB limit
    if (file.size > 15 * 1024 * 1024) {
      const tamanhoMb = (file.size / (1024 * 1024)).toFixed(1);
      toast.error('Arquivo muito grande', {
        description: `"${file.name}" tem ${tamanhoMb}MB e o limite é 15MB. Comprima o arquivo ou envie em partes.`,
      });
      return;
    }

    // Revoga preview anterior se existente
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }

    setSelectedFile(file);
    // Clear audio if any file is uploaded
    setAudioBlob(null);
    setAudioPreviewUrl(null);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
      setMediaName('');
    } else {
      setFilePreview(null);
      // Pré-preenche o nome editável com o nome original (sem extensão)
      const dot = file.name.lastIndexOf('.');
      setMediaName(dot > 0 ? file.name.slice(0, dot) : file.name);
    }
  };

  const handlePasteEvent = (clipboardData: DataTransfer | null, e?: Event | React.SyntheticEvent) => {
    if (!clipboardData) return;
    const items = clipboardData.items;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            if (e) e.preventDefault();
            const isGeneric = !file.name || file.name === 'image.png' || file.name === 'blob';
            const ext = file.type.split('/')[1] || 'png';
            const finalFile = isGeneric
              ? new File([file], `print_${getFormattedDate()}_${Date.now().toString().slice(-4)}.${ext}`, { type: file.type || 'image/png' })
              : file;
            processFile(finalFile);
            toast.info('Print/Imagem colada!', {
              description: 'Você pode digitar uma legenda e pressionar Enter para enviar.',
            });
            setTimeout(() => {
              textInputRef.current?.focus();
            }, 50);
            return;
          }
        }
      }
    }

    const files = clipboardData.files;
    if (files && files.length > 0) {
      if (e) e.preventDefault();
      processFile(files[0]);
      toast.info('Arquivo colado!', {
        description: 'Você pode digitar uma legenda e pressionar Enter para enviar.',
      });
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
    }
  };

  // Global paste handler para facilitar a experiência do atendente (estilo WhatsApp Web)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target !== textInputRef.current) {
        // Se estiver digitando em outro input (ex: busca), não intercepta texto
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          const hasFiles = Array.from(e.clipboardData?.items || []).some(
            (item) => item.type.startsWith('image/') || item.kind === 'file'
          );
          if (!hasFiles) return;
          if (target.closest('[role="dialog"]') || target.closest('[data-modal]')) return;
        }
      }

      if (!selectedChat || !selectedConversation) return;
      handlePasteEvent(e.clipboardData, e);
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [selectedChat, selectedConversation, filePreview, audioPreviewUrl]);

  // Drag and Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (isSending || !selectedConversation) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
      toast.info('Arquivo anexado!', {
        description: 'Você pode digitar uma legenda e pressionar Enter para enviar.',
      });
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);

    if (val.startsWith('/')) {
      setIsTemplatesOpen(true);
      setSlashQuery(val.slice(1));
    } else if (val.includes('/')) {
      const lastSlashIdx = val.lastIndexOf('/');
      const beforeSlash = val.slice(0, lastSlashIdx);
      if (lastSlashIdx === 0 || beforeSlash.endsWith(' ')) {
        setIsTemplatesOpen(true);
        setSlashQuery(val.slice(lastSlashIdx + 1));
      }
    } else {
      if (isTemplatesOpen) {
        setIsTemplatesOpen(false);
      }
    }
  };

  const handleSelectTemplateText = (populatedText: string) => {
    if (newMessage.startsWith('/')) {
      setNewMessage(populatedText);
    } else if (newMessage.includes('/')) {
      const lastSlashIdx = newMessage.lastIndexOf('/');
      const prefix = newMessage.slice(0, lastSlashIdx);
      setNewMessage(prefix ? `${prefix}${populatedText}` : populatedText);
    } else {
      setNewMessage(populatedText);
    }
    setIsTemplatesOpen(false);
    setSlashQuery('');
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 50);
  };

  // Timer for audio recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      // Clear files if recording starts
      if (filePreview) URL.revokeObjectURL(filePreview);
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Nome padrão do áudio (editável no preview)
      const clientNameClean = selectedConversation?.name
        ? sanitizeName(selectedConversation.name)
        : 'cliente';
      setMediaName(`${clientNameClean}_${getFormattedDate()}`);

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error('Acesso ao microfone negado', { description: 'Por favor, conceda permissão de microfone para gravar mensagens de voz.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const cancelSelectedMedia = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setSelectedFile(null);
    setFilePreview(null);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setMediaName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Extrai da exceção uma frase que sirva para o atendente relatar o problema.
   * A Uazapi responde com JSON (`{"error": "..."}`) ou texto puro; ambos são
   * mais úteis que "tente novamente", mas nenhum cabe inteiro num toast.
   */
  const descreverFalhaEnvio = (error: unknown): string => {
    const bruto = error instanceof Error ? error.message : String(error ?? '');
    if (!bruto) return 'Não foi possível enviar sua mensagem. Tente novamente.';

    const corpo = bruto.replace(/^Falha ao enviar mensagem:\s*/, '').trim();
    let texto = corpo;
    try {
      const json = JSON.parse(corpo);
      texto = json.error || json.message || json.detail || corpo;
    } catch {
      // Resposta em texto puro: usa como veio.
    }

    if (/Failed to fetch|NetworkError/i.test(texto)) {
      return 'Sem conexão com o servidor de mensagens. Verifique a internet e tente de novo.';
    }
    return texto.length > 180 ? `${texto.slice(0, 180)}…` : texto;
  };

  const fileToBase64 = (fileOrBlob: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileOrBlob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const sendMessage = async () => {
    const hasMedia = !!selectedFile || !!audioBlob;
    if (!newMessage.trim() && !hasMedia || !selectedChat || !selectedConversation?.phone) return;

    try {
      setIsSending(true);

      let mediaData = '';
      let mediaType = '';
      let fileName = '';
      // Referência ao arquivo ORIGINAL, capturada antes de qualquer limpeza de
      // estado: é ela (e não o base64 montado para a Uazapi) que vai para o
      // Storage depois do envio.
      const arquivoOriginal: File | Blob | null = selectedFile ?? audioBlob;

      if (selectedFile) {
        mediaData = await fileToBase64(selectedFile);
        const isImage = selectedFile.type.startsWith('image/');
        mediaType = isImage ? 'image' : 'document';
        // Documento usa o nome editado no preview, preservando a extensão original
        const dot = selectedFile.name.lastIndexOf('.');
        const ext = dot > 0 ? selectedFile.name.slice(dot) : '';
        fileName = !isImage && mediaName.trim()
          ? `${mediaName.trim()}${ext}`
          : selectedFile.name;
      } else if (audioBlob) {
        mediaData = await fileToBase64(audioBlob);
        mediaType = 'audio';
        const clientNameClean = selectedConversation?.name
          ? sanitizeName(selectedConversation.name)
          : 'cliente';
        fileName = `${mediaName.trim() || `${clientNameClean}_${getFormattedDate()}`}.webm`;
      }

      let finalMessage = newMessage;
      if (selectedAtendente && selectedAtendente !== 'none' && !audioBlob) {
        if (newMessage.trim()) {
          finalMessage = `*${selectedAtendente}*:\n${newMessage}`;
        } else if (hasMedia) {
          finalMessage = `*${selectedAtendente}*:`;
        }
      }

      let providerResponse: unknown;
      if (hasMedia) {
        const typeVal = mediaType === 'audio' ? 'ptt' : mediaType;
        providerResponse = await sendMedia({
          number: selectedConversation.phone,
          type: typeVal,
          file: mediaData,
          caption: finalMessage || '',
          filename: fileName,
        });
      } else {
        providerResponse = await sendText(selectedConversation.phone, finalMessage);
      }

      // Arquiva o anexo no Supabase (bytes no Storage + linha no catálogo).
      // Fire-and-forget de propósito: a mensagem já foi entregue ao cliente, e
      // uma falha de arquivamento não pode virar "erro ao enviar" na tela.
      if (hasMedia && arquivoOriginal) {
        // O id da mensagem, quando a Uazapi devolve, é o que amarra esta linha
        // à mesma mídia que voltará depois no /message/find.
        const messageId = extrairMessageId(providerResponse);

        void registrarMidiaEnviada({
          sessionId: buildChatId(selectedConversation.phone),
          telefone: selectedConversation.phone,
          arquivo: arquivoOriginal,
          nomeArquivo: fileName,
          // O CHECK da tabela não aceita string vazia, e o caminho de fallback
          // pelo webhook pode chegar aqui sem tipo definido.
          tipo: (mediaType || 'outro') as TipoMidia,
          legenda: finalMessage,
          messageId,
          atendenteNome: selectedAtendente !== 'none' ? selectedAtendente : null,
        });
      }

      // Echo otimista: mostra a mensagem imediatamente, sem esperar o realtime
      if (onNewMessage) {
        // Imagens já têm filePreview; áudios têm audioPreviewUrl. Para
        // documentos/PDFs não há preview, então geramos uma URL local aqui —
        // sem isso o card do arquivo não renderiza no momento do envio.
        const localMediaUrl =
          filePreview ||
          audioPreviewUrl ||
          (selectedFile ? URL.createObjectURL(selectedFile) : undefined);
        onNewMessage({
          role: 'assistant',
          content: finalMessage,
          timestamp: new Date().toISOString(),
          type: hasMedia ? mediaType : undefined,
          mediaUrl: localMediaUrl,
          fileName: fileName || undefined,
        });
      }

      setNewMessage('');
      cancelSelectedMedia();

      if (isGroup) {
        toast.success('Mensagem enviada para o grupo', { description: 'Sua mensagem foi enviada com sucesso.' });
      } else {
        toast.success('Mensagem enviada', { description: 'Sua mensagem foi enviada com sucesso.' });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Mostra o motivo real na tela: quem está atendendo não abre o console,
      // e sem isso toda falha de envio vira "tente novamente" sem diagnóstico.
      toast.error('Erro ao enviar mensagem', { description: descreverFalhaEnvio(error) });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && isTemplatesOpen) {
      setIsTemplatesOpen(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isTemplatesOpen) {
        return;
      }
      e.preventDefault();
      sendMessage();
    }
  };

  // Mídia pendente tem botão de envio próprio no box de pré-visualização;
  const hasPendingMedia = !!selectedFile || !!audioBlob;
  const mediaSendLabel = audioBlob
    ? 'Enviar áudio'
    : selectedFile?.type.startsWith('image/')
      ? 'Enviar imagem'
      : 'Enviar arquivo';

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={`relative flex flex-col gap-2 border-t bg-card p-3 transition-colors ${
          isDragging ? 'ring-2 ring-primary ring-inset' : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-background/90 backdrop-blur-sm p-4 text-primary animate-in fade-in zoom-in-95 duration-150 pointer-events-none shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud size={28} className="animate-bounce" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Solte a imagem ou arquivo aqui para anexar</p>
              <p className="text-xs text-muted-foreground">Imagens, prints ou documentos PDF (até 15MB)</p>
            </div>
          </div>
        )}

        {/* Grupo restrito a admins: avisa sem bloquear. A flag vem do cache da
            Uazapi e pode estar desatualizada — travar o envio por causa dela
            criaria chamado de suporte; o erro real do envio ainda aparece. */}
        {isGroup && selectedConversation?.groupSomenteLeitura && (
          <div
            className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground"
            role="status"
          >
            <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Grupo somente leitura.</strong> Só
              administradores enviam mensagens aqui e este número não é admin — o envio
              provavelmente será recusado pelo WhatsApp.
            </span>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,application/pdf"
          className="hidden"
        />

        {/* Media Preview Box */}
        {(selectedFile || audioPreviewUrl) && (
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 p-2 shadow-inner animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex min-w-0 items-center gap-3">
              {selectedFile && filePreview && (
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded border">
                  <img src={filePreview} alt="Pré-visualização da imagem" className="h-full w-full object-cover" />
                </div>
              )}
              {selectedFile && !filePreview && (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-accent text-accent-foreground">
                  <FileText size={24} aria-hidden="true" />
                </div>
              )}
              {audioPreviewUrl && (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-accent text-accent-foreground">
                  <Mic size={24} className="animate-pulse" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {audioBlob || (selectedFile && !selectedFile.type.startsWith('image/')) ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={mediaName}
                      onChange={(e) => setMediaName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={audioBlob ? 'Nome do áudio' : 'Nome do arquivo'}
                      aria-label="Nome do anexo"
                      disabled={isSending}
                      className="h-8 w-full max-w-[260px] text-sm font-medium"
                    />
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {audioBlob
                        ? '.webm'
                        : selectedFile && selectedFile.name.lastIndexOf('.') > 0
                          ? selectedFile.name.slice(selectedFile.name.lastIndexOf('.'))
                          : ''}
                    </span>
                  </div>
                ) : (
                  <p className="truncate text-sm font-medium">{selectedFile?.name}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedFile
                    ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                    : 'Mensagem de voz · pronta para enviar'}
                </p>
              </div>
            </div>

            {audioPreviewUrl && (
              <div className="max-w-xs flex-1 px-2">
                <audio src={audioPreviewUrl} controls className="h-8 max-h-8 w-full" />
              </div>
            )}

            <div className="flex flex-shrink-0 items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remover anexo"
                    onClick={cancelSelectedMedia}
                    disabled={isSending}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Descartar anexo</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    aria-label={mediaSendLabel}
                    onClick={() => sendMessage()}
                    disabled={isSending || !selectedConversation}
                    className="h-9 gap-2 bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                  >
                    {isSending ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send size={16} aria-hidden="true" />
                    )}
                    {mediaSendLabel}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="font-semibold">{mediaSendLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {audioBlob ? 'Envia a mensagem de voz gravada' : 'Envia o anexo com a legenda digitada'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Input Controls */}
        <div className="flex items-center gap-2">
          {/* Attendant Selector */}
          <Select value={selectedAtendente} onValueChange={handleAtendenteChange}>
            <SelectTrigger className="w-32 h-10 shrink-0">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {atendentesAtivos.map((atendente) => (
                <SelectItem key={atendente.id} value={atendente.nome}>{atendente.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Message Templates Popover */}
          <MessageTemplatesPopover
            open={isTemplatesOpen}
            onOpenChange={setIsTemplatesOpen}
            onSelectTemplate={handleSelectTemplateText}
            searchQuery={slashQuery}
            conversation={selectedConversation}
          />

          {/* Message Templates Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Modelos de mensagens (/)"
                disabled={!selectedConversation || isRecording || isSending}
                onClick={() => setIsTemplatesOpen((prev) => !prev)}
                className="flex-shrink-0 hover:border-primary hover:text-primary relative"
              >
                <MessageSquareQuote size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-semibold">Modelos de mensagens</p>
              <p className="text-xs text-muted-foreground">Digite / no teclado ou clique para abrir</p>
            </TooltipContent>
          </Tooltip>

          {/* Attachment Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Anexar imagem ou PDF"
                disabled={!selectedConversation || isRecording || isSending}
                onClick={triggerFileInput}
                className="flex-shrink-0 hover:border-primary hover:text-primary"
              >
                <Paperclip size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-semibold">Anexar mídia</p>
              <p className="text-xs text-muted-foreground">Imagem, PDF (ou cole Ctrl+V / arraste)</p>
            </TooltipContent>
          </Tooltip>

          {/* Voice Message Recorder Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              {isRecording ? (
                <Button
                  type="button"
                  size="icon"
                  aria-label="Parar gravação"
                  onClick={stopRecording}
                  className="flex-shrink-0 animate-pulse bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Square size={18} />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Gravar mensagem de voz"
                  disabled={!selectedConversation || !!selectedFile || isSending}
                  onClick={startRecording}
                  className="flex-shrink-0 hover:border-destructive hover:text-destructive"
                >
                  <Mic size={18} />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-semibold">{isRecording ? 'Parar gravação' : 'Gravar áudio'}</p>
              <p className="text-xs text-muted-foreground">Enviar como mensagem de voz</p>
            </TooltipContent>
          </Tooltip>

          {/* Input field */}
          {isRecording ? (
            <div className="flex flex-1 animate-pulse items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="status">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden="true" />
              <span>Gravando áudio: {formatRecordingTime(recordingTime)}</span>
            </div>
          ) : (
            <Input
              ref={textInputRef}
              placeholder={
                selectedFile
                  ? 'Adicione uma legenda (opcional)...'
                  : audioBlob
                  ? 'Legenda não disponível para áudios'
                  : 'Digite uma mensagem (ou / para modelos)'
              }
              className="flex-1"
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={(e) => handlePasteEvent(e.clipboardData, e)}
              disabled={isSending || (!!audioBlob && !selectedFile)}
            />
          )}

          {/* Send CVI Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                aria-label={isGroup ? "Enviar texto para o grupo" : "Enviar mensagem"}
                className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={
                  isSending ||
                  isRecording ||
                  hasPendingMedia ||
                  !newMessage.trim() ||
                  !selectedConversation
                }
                onClick={() => sendMessage()}
              >
                <Send size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-semibold">{isGroup ? 'Enviar texto para o grupo' : 'Enviar mensagem'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default MessageInput;
