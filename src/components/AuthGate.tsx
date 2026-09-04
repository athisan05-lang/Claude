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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <h1 className="mb-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">Offertenvergleich</h1>
        <p className="mb-5 text-sm text-neutral-500">Bitte anmelden, um fortzufahren.</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">E-Mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
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
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="mb-4 text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          Passwort vergessen?
        </button>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {resetSent && (
          <p className="mb-3 text-sm text-green-700 dark:text-green-400">
            E-Mail zum Zurücksetzen des Passworts wurde verschickt.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? 'Bitte warten…' : 'Anmelden'}
        </button>

        <p className="mt-4 text-xs text-neutral-400">
          Kein Konto? Neue Zugänge werden von deinem Admin per Einladung eingerichtet.
        </p>
      </form>
    </div>
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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <h1 className="mb-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">Passwort festlegen</h1>
        <p className="mb-5 text-sm text-neutral-500">Bitte ein Passwort für dein Konto vergeben.</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">Neues Passwort</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
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
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? 'Bitte warten…' : 'Passwort speichern'}
        </button>
      </form>
    </div>
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
      <div className="flex items-center justify-end gap-3 border-b border-neutral-200 bg-white px-4 py-1.5 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="truncate">{session?.user.email}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Abmelden
        </button>
      </div>
      {children}
    </div>
  );
}
