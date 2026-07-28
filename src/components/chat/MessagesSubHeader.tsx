
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Download, Search, X } from 'lucide-react';
import { Conversation, ChatMessage } from '@/types/chat';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface MessagesSubHeaderProps {
  selectedConversation?: Conversation;
  messages: ChatMessage[];
  onSearchMessages?: (searchTerm: string) => void;
}

const MessagesSubHeader = ({ selectedConversation, messages, onSearchMessages }: MessagesSubHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleExportMessages = () => {
    if (!selectedConversation || messages.length === 0) return;
    
    const exportData = {
      cliente: selectedConversation.name,
      telefone: selectedConversation.phone,
      dataExportacao: new Date().toISOString(),
      mensagens: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mensagens_${selectedConversation.name}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSearch = () => {
    if (onSearchMessages && searchTerm.trim()) {
      onSearchMessages(searchTerm.trim());
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    if (onSearchMessages) {
      onSearchMessages('');
    }
  };

  return (
    <div className="border-b bg-muted/50 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            Mensagens
          </span>
          {selectedConversation && (
            <Badge variant="secondary" className="tabular-nums">
              <MessageSquare className="mr-1 h-3 w-3" aria-hidden="true" />
              {messages.length}
            </Badge>
          )}
        </div>

        <div className="flex gap-1.5">
          <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 bg-card text-muted-foreground hover:bg-muted"
                disabled={!selectedConversation}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Buscar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Buscar Mensagens</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite o termo de busca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  {searchTerm && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearSearch}
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleSearch} disabled={!searchTerm.trim()} className="flex-1">
                    Buscar
                  </Button>
                  <Button variant="outline" onClick={() => setIsSearchOpen(false)} className="flex-1">
                    Fechar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            size="sm"
            variant="outline"
            className="gap-2 bg-card text-muted-foreground hover:bg-muted"
            disabled={!selectedConversation || messages.length === 0}
            onClick={handleExportMessages}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MessagesSubHeader;
