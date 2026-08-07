/**
 * Přihlášení editora. Registrace není veřejná – účty zakládá správce
 * v Supabase, tady je jen e-mail + heslo.
 */

import { useState, type FormEvent } from 'react';
import { cs } from '../i18n/cs';
import { Field, Modal } from './ui';

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
  onClose: () => void;
}

export function AuthPanel({ onSignIn, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSignIn(email.trim(), password);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/invalid login/i.test(message) ? cs.auth.invalidCredentials : message || cs.auth.signInFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={cs.auth.signInTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            {cs.app.cancel}
          </button>
          <button type="submit" form="auth-form" className="button button-primary" disabled={busy}>
            {busy ? cs.auth.signingIn : cs.auth.signIn}
          </button>
        </>
      }
    >
      <form id="auth-form" className="form" onSubmit={handleSubmit}>
        <Field label={cs.auth.email} htmlFor="auth-email">
          <input
            id="auth-email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
        </Field>
        <Field label={cs.auth.password} htmlFor="auth-password">
          <input
            id="auth-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </Modal>
  );
}
