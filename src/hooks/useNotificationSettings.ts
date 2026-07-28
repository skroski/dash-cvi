import { useCallback, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
  getNotificationSettings,
  previewNotificationChime,
  subscribeNotificationSettings,
  updateNotificationSettings,
} from '@/lib/notificationSound';

/**
 * Preferências de notificação (som e notificações do navegador) sincronizadas
 * entre componentes e entre abas.
 */
export function useNotificationSettings() {
  const settings = useSyncExternalStore(
    subscribeNotificationSettings,
    getNotificationSettings
  );

  const toggleSound = useCallback(() => {
    const enabling = !getNotificationSettings().soundEnabled;
    updateNotificationSettings({ soundEnabled: enabling });
    if (enabling) previewNotificationChime(); // confirma ao usuário que o som voltou
  }, []);

  const toggleBrowserNotifications = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Notificações do navegador não são suportadas neste dispositivo.');
      return;
    }

    if (getNotificationSettings().browserEnabled) {
      updateNotificationSettings({ browserEnabled: false });
      return;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      updateNotificationSettings({ browserEnabled: true });
      toast.success('Notificações do navegador ativadas', {
        description: 'Você será avisado de novas mensagens mesmo com a aba em segundo plano.',
      });
    } else {
      updateNotificationSettings({ browserEnabled: false });
      toast.error('Permissão de notificação negada', {
        description: 'Habilite as notificações deste site nas configurações do navegador.',
      });
    }
  }, []);

  return {
    soundEnabled: settings.soundEnabled,
    browserEnabled: settings.browserEnabled,
    toggleSound,
    toggleBrowserNotifications,
  };
}
