/** Sdílené drobné komponenty: modál, potvrzovací dialog, pole formuláře. */

import { useEffect, useRef, type ReactNode } from 'react';
import { cs } from '../i18n/cs';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** široký modál pro formuláře */
  wide?: boolean;
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={cs.app.close}>
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button" onClick={onCancel}>
            {cs.app.cancel}
          </button>
          <button
            type="button"
            className={`button ${destructive ? 'button-danger' : 'button-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? cs.app.confirm}
          </button>
        </>
      }
    >
      <p className="confirm-body">{body}</p>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, optional, children }: FieldProps) {
  return (
    <div className={`field${error ? ' field-error' : ''}`}>
      <label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="field-optional"> ({cs.form.optional})</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? (
        <p className="field-message" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner-dot" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
