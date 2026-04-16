import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const loadCompanyData = async (userId: string, companyId?: string) => {
    try {
      if (!companyId) {
        setCompanyUser(null);
        setCompany(null);
        return;
      }

      console.log('[Auth] Iniciando busca no SDK do Supabase para user_id:', userId, 'companyId:', companyId);

      const { data: userProfile, error: e1 } = await supabase
        .from('company_users')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .single();
        
      if (e1) console.error('[Auth] Erro no SDK (userProfile):', e1);
      console.log('[Auth] userProfile retornado.');

      const { data: companyData, error: e2 } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (e2) console.error('[Auth] Erro no SDK (companyData):', e2);
      console.log('[Auth] companyData retornado.');

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
        await loadCompanyData(session.user.id, companyId);
      }
    } catch (err) {
      console.error('Erro ao atualizar empresa:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    console.log('[Auth] Gerenciador de Autenticação iniciado.');

    // Timeout de segurança: Se em 7 segundos nada acontecer, libera o carregamento
    const safetyTimeout = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn('[Auth] Timeout de segurança atingido. Liberando UI.');
        setIsLoading(false);
      }
    }, 7000);

    // Inscrição no evento de mudança de estado, SEM AWAIT para evitar Deadlock no cliente do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log(`[Auth] Evento recebido: ${event}`);
      
      if (!isMounted) return;

      // Sincroniza usuário e sessão de forma síncrona
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        const companyId = currentSession.user.app_metadata?.company_id;
        console.log(`[Auth] Usuário logado: ${currentSession.user.email}. Empresa no JWT: ${companyId || 'Nenhuma'}`);
        
        if (companyId) {
          // Chama a busca sem bloquear a thread do Auth do Supabase! (Evita Hang)
          loadCompanyData(currentSession.user.id, companyId).then(() => {
             if (isMounted) {
               setIsLoading(false);
               clearTimeout(safetyTimeout);
             }
          });
        } else {
          setCompanyUser(null);
          setCompany(null);
          setIsLoading(false);
          clearTimeout(safetyTimeout);
        }
      } else {
        setCompanyUser(null);
        setCompany(null);
        setIsLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
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
