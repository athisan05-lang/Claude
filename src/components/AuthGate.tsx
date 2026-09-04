import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type Status = 'loading' | 'signedOut' | 'needsPassword' | 'signedIn';

function hasAuthLinkType(type: string): boolean {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  return hash.get('type') === type || search.get('type') === type;
}

function clearUrlHash() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-xl font-bold text-white shadow-lg shadow-indigo-600/20">
            O
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{title}</h1>
            <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-900/5 dark:border-neutral-800 dark:bg-neutral-900">
          {children}
        </div>
      </div>
    </div>
  );
}

function fieldClass() {
  return 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-neutral-700 dark:bg-neutral-950';
}

function primaryButtonClass() {
  return 'w-full rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-60';
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError('Anmeldung fehlgeschlagen: E-Mail oder Passwort ist falsch.');
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Bitte zuerst deine E-Mail-Adresse oben eintragen.');
      return;
    }
    setError('');
    setBusy(true);
    const redirectTo = window.location.origin + import.meta.env.BASE_URL;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (err) setError('Zurücksetzen fehlgeschlagen. Bitte später nochmals versuchen.');
    else setResetSent(true);
  }

  return (
    <AuthCard title="Offertenvergleich" subtitle="Bitte anmelden, um fortzufahren">
      <form onSubmit={handleSubmit}>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">E-Mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass()}
          />
        </label>

        <label className="mb-1 block text-sm">
          <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">Passwort</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass()}
          />
        </label>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="mb-4 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Passwort vergessen?
        </button>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {resetSent && (
          <p className="mb-3 text-sm text-green-700 dark:text-green-400">
            E-Mail zum Zurücksetzen des Passworts wurde verschickt.
          </p>
        )}

        <button type="submit" disabled={busy} className={primaryButtonClass()}>
          {busy ? 'Bitte warten…' : 'Anmelden'}
        </button>

        <p className="mt-4 text-center text-xs text-neutral-400">
          Kein Konto? Neue Zugänge werden von deinem Admin per Einladung eingerichtet.
        </p>
      </form>
    </AuthCard>
  );
}

function SetPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== confirm) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError('Konnte Passwort nicht setzen. Bitte den Einladungs-/Reset-Link nochmals öffnen.');
      return;
    }
    clearUrlHash();
    onDone();
  }

  return (
    <AuthCard title="Passwort festlegen" subtitle="Bitte ein Passwort für dein Konto vergeben">
      <form onSubmit={handleSubmit}>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">Neues Passwort</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass()}
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">Passwort bestätigen</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={fieldClass()}
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button type="submit" disabled={busy} className={primaryButtonClass()}>
          {busy ? 'Bitte warten…' : 'Passwort speichern'}
        </button>
      </form>
    </AuthCard>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const isRecoveryLink = hasAuthLinkType('recovery') || hasAuthLinkType('invite');

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? (isRecoveryLink ? 'needsPassword' : 'signedIn') : 'signedOut');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY' || (newSession && isRecoveryLink)) {
        setStatus('needsPassword');
      } else {
        setStatus(newSession ? 'signedIn' : 'signedOut');
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-950">
        Lädt…
      </div>
    );
  }

  if (status === 'signedOut') return <LoginForm />;

  if (status === 'needsPassword') {
    return <SetPasswordForm onDone={() => setStatus('signedIn')} />;
  }

  return (
    <div>
      <div className="sticky top-0 z-40 flex items-center justify-end gap-3 border-b border-neutral-200 bg-white/80 px-4 py-1.5 text-xs text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <span className="truncate">{session?.user.email}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-full border border-neutral-300 px-2.5 py-0.5 font-medium transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Abmelden
        </button>
      </div>
      {children}
    </div>
  );
}
