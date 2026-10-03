// Customer sign-in with a 6-digit email code (Supabase Auth OTP). No passwords.
import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { ApiError } from './api';
import { supabase } from './supabase';

type Auth = {
  session: Session | null; ready: boolean;
  sendCode: (email: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthCtx = createContext<Auth | null>(null);

const authError = (m: string) =>
  /rate|too many|security purposes/i.test(m) ? new ApiError('signin.tooMany', m)
    : /invalid|expired|otp|token/i.test(m) ? new ApiError('signin.badCode', m)
      : /email/i.test(m) ? new ApiError('signin.badEmail', m)
        : /fetch|network/i.test(m) ? new ApiError('err.network', m) : new ApiError('err.generic', m);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const value: Auth = {
    session, ready,
    async sendCode(email) {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      if (error) throw authError(error.message);
    },
    async verify(email, code) {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
      if (error) throw authError(error.message);
    },
    async signOut() { await supabase.auth.signOut(); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => { const v = useContext(AuthCtx); if (!v) throw new Error('AuthProvider missing'); return v; };
