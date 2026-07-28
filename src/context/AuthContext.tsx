
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthError, Provider } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePerfil } from '@/hooks/usePerfil';
import { Papel, Perfil } from '@/types/perfil';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /** Perfil do usuário logado (papel, vínculo, situação). */
  perfil: Perfil | null;
  papel: Papel | null;
  isAdmin: boolean;
  /** Admin ou líder: enxerga a operação da equipe. */
  isGestor: boolean;
  /**
   * True enquanto as migrações de perfis não forem aplicadas. Nesse estado o
   * painel opera no modo antigo (login único) em vez de bloquear o acesso.
   */
  setupPendente: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: AuthError | null;
    data: Session | null;
  }>;
  signOut: () => Promise<void>;
  signInWithSocial: (provider: Provider) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const response = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    
    return {
      error: response.error,
      data: response.data.session
    };
  };

  const signInWithSocial = async (provider: Provider) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider,
        options: {
          redirectTo: window.location.origin + '/dashboard'
        }
      });
      
      if (error) {
        console.error('Social login error:', error);
        toast.error(`Erro ao fazer login com ${provider}: ${error.message}`);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Unexpected error during social login:', error);
      toast.error('Erro inesperado ao fazer login social');
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    navigate('/');
    setIsLoading(false);
  };

  const { perfil, loading: perfilLoading, setupPendente } = usePerfil(user?.id ?? null);

  const value = {
    session,
    user,
    isLoading: isLoading || perfilLoading,
    perfil,
    papel: perfil?.papel ?? null,
    isAdmin: perfil?.papel === 'admin',
    isGestor: perfil?.papel === 'admin' || perfil?.papel === 'lider',
    setupPendente,
    signIn,
    signOut,
    signInWithSocial,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
