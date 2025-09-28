'use client';

import { useState, CSSProperties } from 'react';
import { checkUser, validateRapidKey } from '../lib/checker';
import {
  parseWorkbook,
  sheetToRows,
  writeRowsToSheet,
  downloadWorkbook,
  downloadCSV,
  Row,
  Workbook,
} from '../lib/excel';

type Phase = 'enter-key' | 'key-ok' | 'file-ready' | 'verifying' | 'done';

export default function Page() {
  const [phase, setPhase] = useState<Phase>('enter-key');
  const [rapidKey, setRapidKey] = useState('');
  const [host, setHost] = useState('id-game-checker.p.rapidapi.com');

  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [sheetName, setSheetName] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [results, setResults] = useState<Row[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [keyChecked, setKeyChecked] = useState(false);

  const keyOk =
    phase === 'key-ok' || phase === 'file-ready' || phase === 'verifying' || phase === 'done';

  const btn = (opts?: { variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean }): CSSProperties => {
    const variant = opts?.variant ?? 'primary';
    const disabled = !!opts?.disabled;
    const base: CSSProperties = {
      padding: '10px 16px',
      borderRadius: 10,
      fontWeight: 600,
      border: '1px solid transparent',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.7 : 1,
      userSelect: 'none',
    };
    if (variant === 'primary') {
      return { ...base, background: disabled ? '#4b6ea9' : '#1f6feb', borderColor: '#1b5fd6', color: '#fff' };
    }
    if (variant === 'secondary') {
      return { ...base, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff' };
    }
    return { ...base, background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' };
  };

  async function onValidateKey() {
    setError(null);
    setKeyChecked(true);
    if (!rapidKey.trim()) {
      setError('Please paste your RapidAPI key.');
      return;
    }
    const ok = await validateRapidKey(rapidKey.trim(), host.trim());
    if (!ok) {
      setError('RapidAPI key appears invalid or unauthorized for this host.');
      return;
    }
    setPhase('key-ok');
  }

  async function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      setError('Please upload an .xlsx Excel file.');
      return;
    }
    try {
      const { workbook, firstSheet } = await parseWorkbook(f);
      const sheet = firstSheet;
      const data = sheetToRows(workbook, sheet);
      setWorkbook(workbook);
      setSheetName(sheet);
      setRows(data);
      setResults([]);
      setFile(f);
      setPhase('file-ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read Excel file.';
      setError(msg);
    }
  }

  async function onVerify() {
    if (!workbook || !sheetName || !rows.length) {
      setError('No rows to verify.');
      return;
    }
    setPhase('verifying');
    setError(null);
    const out: Row[] = [];
    let done = 0;
    const total = rows.length;
    setProgress({ done, total });

    for (const r of rows) {
      const server = r.D_server;
      const uid = r.E_id;
      let status = '';
      let username = '';

      if (!server || !uid) {
        status = '';
        username = '';
      } else {
        try {
          const res = await checkUser(rapidKey.trim(), String(uid), String(server), host.trim());
          if (res.ok) {
            status = `user verified${res.mapping ? ` (${res.mapping})` : ''}`;
            username = res.username;
          } else {
            status = 'user not found';
            username = '';
          }
        } catch {
          status = 'error';
          username = '';
        }
      }

      const updated: Row = { ...r, C_username: username, F_status: status };
      out.push(updated);

      done += 1;
      setProgress({ done, total });
      await new Promise((res) => setTimeout(res, 150));
    }

    writeRowsToSheet(workbook, sheetName, out);
    setResults(out);
    setPhase('done');
  }

  function onDownloadExcel() {
    if (!workbook) return;
    const base = file?.name?.replace(/\.xlsx$/i, '') || 'verified';
    downloadWorkbook(workbook, `${base}.verified.xlsx`);
  }

  function onDownloadCSV() {
    downloadCSV(results, 'verified.csv');
  }

  function resetAll() {
    setPhase('enter-key');
    setRapidKey('');
    setHost('id-game-checker.p.rapidapi.com');
    setFile(null);
    setWorkbook(null);
    setSheetName('');
    setRows([]);
    setResults([]);
    setProgress({ done: 0, total: 0 });
    setError(null);
    setKeyChecked(false);
  }

  const fileDisabled = !keyOk || phase === 'verifying';

  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>MLBB Verify (Excel ⇄ RapidAPI)</h1>
      <p style={{ opacity: 0.85 }}>
        Upload your Excel file, enter your RapidAPI key, and verify MLBB usernames. We’ll write
        Username → <strong>C</strong> and Status → <strong>F</strong>.
      </p>

      {/* 1) Key */}
      <section style={{ marginTop: 24, padding: 16, border: '1px solid #3a3a3a', borderRadius: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>1) RapidAPI key</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <input
            type="password"
            placeholder="Paste your RapidAPI key"
            value={rapidKey}
            onChange={(e) => setRapidKey(e.target.value)}
            style={{ flex: 1, minWidth: 280, padding: 10, borderRadius: 10, border: '1px solid #3a3a3a', background: 'rgba(255,255,255,0.06)', color: 'inherit' }}
          />
          <input
            type="text"
            placeholder="Host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            style={{ width: 280, padding: 10, borderRadius: 10, border: '1px solid #3a3a3a', background: 'rgba(255,255,255,0.06)', color: 'inherit' }}
          />
          <button onClick={onValidateKey} disabled={!rapidKey || phase === 'verifying'} style={btn({ variant: 'primary', disabled: !rapidKey || phase === 'verifying' })}>
            Validate key
          </button>
          {keyOk && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Key OK</span>}
          {!keyOk && keyChecked && !error && <span style={{ color: '#9ca3af' }}>Click “Validate key” to continue</span>}
        </div>
      </section>

      {/* 2) Upload */}
      <section style={{ marginTop: 24, padding: 16, border: '1px solid #3a3a3a', borderRadius: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>2) Upload Excel (.xlsx)</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <input id="xlsx-file" type="file" accept=".xlsx" onChange={onSelectFile} disabled={fileDisabled} style={{ display: 'none' }} />
          <label htmlFor="xlsx-file" style={{ ...btn({ variant: 'secondary', disabled: fileDisabled }), pointerEvents: fileDisabled ? 'none' : 'auto' }}>
            Choose .xlsx
          </label>
          <span style={{ fontSize: 14, opacity: 0.85 }}>
            {file ? (<><strong>{file.name}</strong> — sheet <strong>{sheetName}</strong> — rows <strong>{rows.length}</strong></>) : 'No file selected'}
          </span>
        </div>
      </section>

      {/* 3) Verify */}
      <section style={{ marginTop: 24, padding: 16, border: '1px solid #3a3a3a', borderRadius: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>3) Verify</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <button onClick={onVerify} disabled={!file || phase === 'verifying'} style={btn({ variant: 'primary', disabled: !file || phase === 'verifying' })}>
            {phase === 'verifying' ? 'Verifying…' : 'Verify'}
          </button>
          <button onClick={resetAll} disabled={phase === 'verifying'} style={btn({ variant: 'ghost', disabled: phase === 'verifying' })}>
            Reset
          </button>
        </div>

        {phase === 'verifying' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 10, background: '#2a2a2a', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, height: '100%', background: '#1f6feb', transition: 'width .25s ease' }} />
            </div>
            <small style={{ opacity: 0.8 }}>{progress.done} / {progress.total}</small>
          </div>
        )}
      </section>

      {/* Errors */}
      {error && <p style={{ color: '#ef4444', marginTop: 12 }}><strong>Error:</strong> {error}</p>}

      {/* Results */}
      {(phase === 'done' || phase === 'verifying') && results.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Results</h3>
          <div style={{ overflowX: 'auto', border: '1px solid #3a3a3a', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <th style={{ textAlign: 'left', padding: 10 }}>Row</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Server (D)</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>ID (E)</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Username (C)</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Status (F)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.rowIndex} style={{ borderTop: '1px solid #2a2a2a' }}>
                    <td style={{ padding: 10 }}>{r.rowIndex}</td>
                    <td style={{ padding: 10 }}>{String(r.D_server ?? '')}</td>
                    <td style={{ padding: 10 }}>{String(r.E_id ?? '')}</td>
                    <td style={{ padding: 10 }}>{r.C_username ?? ''}</td>
                    <td style={{ padding: 10 }}>{r.F_status ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button style={btn({ variant: 'primary' })} onClick={onDownloadExcel}>Download .xlsx</button>
            <button style={btn({ variant: 'secondary' })} onClick={onDownloadCSV}>Download .csv</button>
          </div>
        </section>
      )}

      <hr style={{ margin: '28px 0', borderColor: '#3a3a3a' }} />
      <details>
        <summary style={{ cursor: 'pointer' }}>How columns are mapped</summary>
        <ul style={{ marginTop: 8, opacity: 0.85 }}>
          <li><strong>D</strong> → Server (input)</li>
          <li><strong>E</strong> → ID (input)</li>
          <li><strong>C</strong> → Username (output)</li>
          <li><strong>F</strong> → Status (output)</li>
        </ul>
      </details>
    </main>
  );
}
