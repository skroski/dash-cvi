
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/types/chat';

interface UseRealtimeUpdatesProps {
  updateConversationLastMessage: (sessionId: string) => Promise<void>;
  fetchConversations: () => Promise<void>;
}

export function useRealtimeUpdates({ 
  updateConversationLastMessage,
  fetchConversations 
}: UseRealtimeUpdatesProps) {
  
  useEffect(() => {
    console.log('Setting up realtime updates for chat history');
    
    // Create a single subscription for chat history updates
    const subscription = supabase
      .channel('n8n_chat_histories_updates')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'n8n_chat_histories' 
        }, 
        (payload) => {
          console.log('New chat history entry detected:', payload);
          
          const sessionId = payload.new.session_id;
          console.log(`Processing message for session: ${sessionId}`);
          
          // First update the last message in the conversation list
          updateConversationLastMessage(sessionId)
            .then(() => console.log(`Updated last message for conversation: ${sessionId}`))
            .catch(error => console.error(`Error updating conversation: ${error}`));
        }
      )
      .subscribe();
      
    console.log('Realtime subscription established');
      
    return () => {
      console.log('Cleaning up realtime subscription');
      subscription.unsubscribe();
    };
  }, [updateConversationLastMessage, fetchConversations]);
}
