/**
 * Export a import dat. Export je dostupný komukoli (data jsou veřejná ke čtení),
 * import jen přihlášeným.
 */

import { useRef, useState } from 'react';
import { cs } from '../i18n/cs';
import { exportFileName, parseImport, serializeExport } from '../data/transfer';
import type { Dataset } from '../data/types';
import { ConfirmDialog, Modal } from './ui';

interface Props {
  dataset: Dataset;
  canEdit: boolean;
  onImport: (dataset: Dataset, mode: 'merge' | 'replace') => Promise<void>;
  onClose: () => void;
}

export function DataPanel({ dataset, canEdit, onImport, onClose }: Props) {
  const [pending, setPending] = useState<Dataset | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const blob = new Blob([serializeExport(dataset)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setDone(null);
    const text = await file.text();
    const result = parseImport(text);
    if (!result.ok) {
      setPending(null);
      setFileName(file.name);
      setError(result.error);
      return;
    }
    setPending(result.dataset);
    setFileName(file.name);
  };

  const runImport = async () => {
    if (!pending) return;
    setConfirming(false);
    setRunning(true);
    setError(null);
    try {
      await onImport(pending, mode);
      setDone(cs.dataIO.importDone(pending.categories.length, pending.tags.length, pending.events.length));
      setPending(null);
      setFileName(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : cs.form.saveError);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Modal
        title={cs.dataIO.title}
        onClose={onClose}
        wide
        footer={
          <button type="button" className="button" onClick={onClose}>
            {cs.app.close}
          </button>
        }
      >
        <section className="data-section">
          <h3>{cs.dataIO.overview}</h3>
          <p className="data-counts">
            {cs.dataIO.counts(dataset.categories.length, dataset.tags.length, dataset.events.length)}
          </p>
        </section>

        <section className="data-section">
          <h3>{cs.dataIO.export}</h3>
          <p className="muted">{cs.dataIO.exportHint}</p>
          <button type="button" className="button button-primary" onClick={handleExport}>
            {cs.dataIO.export}
          </button>
        </section>

        <section className="data-section">
          <h3>{cs.dataIO.import}</h3>
          {!canEdit ? (
            <p className="muted">{cs.dataIO.signInRequired}</p>
          ) : (
            <>
              <p className="muted">{cs.dataIO.importHint}</p>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="file-input"
                aria-label={cs.dataIO.fileLabel}
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />

              {error ? <p className="form-error">{error}</p> : null}
              {done ? <p className="form-success">{done}</p> : null}

              {pending ? (
                <div className="import-preview">
                  <h4>{cs.dataIO.previewTitle}</h4>
                  <p>{fileName}</p>
                  <p>{cs.dataIO.previewCounts(pending.categories.length, pending.tags.length, pending.events.length)}</p>

                  <fieldset className="import-mode">
                    <legend>{cs.dataIO.modeLabel}</legend>
                    <label className="radio-row">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={mode === 'merge'}
                        onChange={() => setMode('merge')}
                      />
                      <span>
                        <strong>{cs.dataIO.modeMerge}</strong>
                        <span className="field-hint">{cs.dataIO.modeMergeHint}</span>
                      </span>
                    </label>
                    <label className="radio-row">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={mode === 'replace'}
                        onChange={() => setMode('replace')}
                      />
                      <span>
                        <strong>{cs.dataIO.modeReplace}</strong>
                        <span className="field-hint">{cs.dataIO.modeReplaceHint}</span>
                      </span>
                    </label>
                  </fieldset>

                  <button
                    type="button"
                    className={`button ${mode === 'replace' ? 'button-danger' : 'button-primary'}`}
                    disabled={running}
                    onClick={() => setConfirming(true)}
                  >
                    {running ? cs.dataIO.importing : cs.dataIO.runImport}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </Modal>

      {confirming ? (
        <ConfirmDialog
          title={mode === 'replace' ? cs.dataIO.confirmReplaceTitle : cs.dataIO.confirmMergeTitle}
          body={mode === 'replace' ? cs.dataIO.confirmReplaceBody : cs.dataIO.confirmMergeBody}
          confirmLabel={cs.dataIO.runImport}
          destructive={mode === 'replace'}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void runImport()}
        />
      ) : null}
    </>
  );
}
