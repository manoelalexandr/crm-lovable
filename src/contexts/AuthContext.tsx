import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

type CompanyUser = Tables<'company_users'>;
type Company = Tables<'companies'>;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  companyUser: CompanyUser | null;
  company: Company | null;
  isLoading: boolean;
  hasCompany: boolean;
  signOut: () => Promise<void>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const lastFetchedRef = useRef({ userId: '', companyId: '' });

  // --- NOVA FUNÇÃO: Atualiza o status de Online/Offline no Banco ---
  const setOnlineStatus = async (userId: string, isOnline: boolean) => {
    try {
      await supabase
        .from('company_users')
        .update({ status: isOnline ? 'online' : 'offline' })
        .eq('user_id', userId);
    } catch (err) {
      console.error('[Auth] Erro ao atualizar status online:', err);
    }
  };

  const loadCompanyData = async (userId: string, companyId?: string) => {
    try {
      if (!companyId) {
        setCompanyUser(null);
        setCompany(null);
        return;
      }

      const { data: userProfile, error: e1 } = await supabase
        .from('company_users')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .single();

      if (e1) console.error('[Auth] Erro no SDK (userProfile):', e1);

      const { data: companyData, error: e2 } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (e2) console.error('[Auth] Erro no SDK (companyData):', e2);

      setCompanyUser(userProfile as CompanyUser | null);
      setCompany(companyData as Company | null);
    } catch (err) {
      console.error('Erro na carga inicial do AuthContext:', err);
      setCompanyUser(null);
      setCompany(null);
    }
  };

  const refreshCompany = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      const session = data?.session;
      if (session?.user) {
        const companyId = session.user.app_metadata?.company_id;
        lastFetchedRef.current = { userId: '', companyId: '' };
        await loadCompanyData(session.user.id, companyId);
      }
    } catch (err) {
      console.error('Erro ao atualizar empresa:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const safetyTimeout = setTimeout(() => {
      if (isMounted && isLoading) {
        setIsLoading(false);
      }
    }, 7000);

    // --- NOVO: Fica de olho se o usuário fechar a aba do navegador ---
    const handleBeforeUnload = () => {
      const currentUserId = lastFetchedRef.current.userId;
      if (currentUserId) {
        // Dispara a requisição para ficar offline sem esperar (para não travar o fechamento da aba)
        supabase.from('company_users').update({ status: 'offline' }).eq('user_id', currentUserId).then();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const companyId = currentSession.user.app_metadata?.company_id;
        const userId = currentSession.user.id;

        if (lastFetchedRef.current.userId !== userId || lastFetchedRef.current.companyId !== companyId) {

          // Se tinha alguém logado antes na mesma máquina, desloga ele primeiro
          if (lastFetchedRef.current.userId && lastFetchedRef.current.userId !== userId) {
            setOnlineStatus(lastFetchedRef.current.userId, false);
          }

          lastFetchedRef.current = { userId, companyId: companyId || '' };

          loadCompanyData(userId, companyId).then(() => {
            // MARCA COMO ONLINE ASSIM QUE CARREGAR OS DADOS
            setOnlineStatus(userId, true);
            if (isMounted) {
              setIsLoading(false);
              clearTimeout(safetyTimeout);
            }
          });
        } else {
          if (isMounted) {
            setIsLoading(false);
            clearTimeout(safetyTimeout);
          }
        }
      } else {
        // MARCA COMO OFFLINE QUANDO A SESSÃO ACABAR/DESLOGAR
        if (lastFetchedRef.current.userId) {
          setOnlineStatus(lastFetchedRef.current.userId, false);
        }
        setCompanyUser(null);
        setCompany(null);
        setIsLoading(false);
        clearTimeout(safetyTimeout);
        lastFetchedRef.current = { userId: '', companyId: '' };
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const signOut = async () => {
    if (user?.id) {
      await setOnlineStatus(user?.id, false); // Força offline antes de destruir a sessão
    }
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    companyUser,
    company,
    isLoading,
    hasCompany: !!user?.app_metadata?.company_id,
    signOut,
    refreshCompany,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}