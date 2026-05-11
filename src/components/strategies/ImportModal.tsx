'use client';

import { useState, useRef, useCallback } from 'react';
import {
  X, Upload, Loader2, ClipboardPaste, Check, AlertCircle, Sparkles, Trash2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImportedHolding {
  symbol: string;
  name: string;
  weight: number;
  quantity?: number;
  marketPrice?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (holdings: ImportedHolding[]) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImportModal({ open, onClose, onImport }: Props) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedHoldings, setParsedHoldings] = useState<ImportedHolding[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── Parse text via AI ──────────────────────────────────────────────────

  const parseText = useCallback(async (text: string) => {
    setIsParsing(true);
    setError(null);
    setParsedHoldings(null);
    try {
      const res = await fetch('/api/ai/parse-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text }),
      });
      const data = await res.json();
      if (data.error && !data.holdings?.length) {
        setError(data.error);
        return;
      }
      if (data.holdings?.length > 0) {
        const holdings = buildHoldings(data.holdings);
        setParsedHoldings(holdings);
        setExcluded(new Set());
      } else {
        setError('Aucune position détectée. Vérifiez le format des données.');
      }
    } catch {
      setError("Erreur lors de l'analyse. Réessayez.");
    } finally {
      setIsParsing(false);
    }
  }, []);

  // ── Parse image via AI Vision ──────────────────────────────────────────

  const parseImage = useCallback(async (base64: string, mimeType: string) => {
    setIsParsing(true);
    setError(null);
    setParsedHoldings(null);
    try {
      const res = await fetch('/api/ai/parse-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      });
      const data = await res.json();
      if (data.holdings?.length > 0) {
        const holdings = buildHoldings(data.holdings);
        setParsedHoldings(holdings);
        setExcluded(new Set());
      } else {
        setError("Aucune position détectée dans l'image. Assurez-vous que les titres/symboles sont lisibles.");
      }
    } catch {
      setError("Erreur lors de l'analyse de l'image.");
    } finally {
      setIsParsing(false);
    }
  }, []);

  // ── Build holdings with weights ────────────────────────────────────────

  function buildHoldings(
    raw: Array<{ symbol: string; name?: string; quantity?: number; marketPrice?: number }>
  ): ImportedHolding[] {
    // Try to compute weights from market values
    const withValues = raw.map(h => ({
      symbol: h.symbol,
      name: h.name ?? h.symbol,
      quantity: h.quantity ?? 0,
      marketPrice: h.marketPrice ?? 0,
      marketValue: (h.quantity ?? 0) * (h.marketPrice ?? 0),
    }));

    const totalMV = withValues.reduce((s, h) => s + h.marketValue, 0);
    const useMarketValue = totalMV > 0 && withValues.filter(h => h.marketValue > 0).length > 1;

    return withValues.map(h => ({
      symbol: h.symbol,
      name: h.name,
      weight: useMarketValue && totalMV > 0
        ? Math.round((h.marketValue / totalMV) * 1000) / 10
        : Math.round(100 / withValues.length * 10) / 10,
      quantity: h.quantity,
      marketPrice: h.marketPrice,
    }));
  }

  // ── Handle file ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();

    // Image → vision AI
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        parseImage(base64, file.type);
      };
      reader.readAsDataURL(file);
      return;
    }

    // CSV / TXT → text AI
    if (ext === 'csv' || ext === 'txt') {
      const text = await file.text();
      parseText(text);
      return;
    }

    // Excel → convert to CSV then text AI
    if (ext === 'xlsx' || ext === 'xls') {
      setIsParsing(true);
      setError(null);
      try {
        const XLSX = (await import('xlsx')).default;
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        await parseText(csv);
      } catch {
        setError("Erreur de lecture du fichier Excel. Essayez de copier-coller depuis Excel.");
        setIsParsing(false);
      }
      return;
    }

    setError(`Format non supporté: .${ext}. Utilisez CSV, Excel (.xlsx), ou une image (.jpg, .png).`);
  }, [parseText, parseImage]);

  // ── Drag & drop ────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Toggle holding exclusion ───────────────────────────────────────────

  const toggleExclude = (idx: number) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ── Confirm import ─────────────────────────────────────────────────────

  const confirmImport = useCallback(() => {
    if (!parsedHoldings) return;
    const selected = parsedHoldings.filter((_, i) => !excluded.has(i));
    if (selected.length === 0) return;

    // Recalculate equal weights for selected holdings
    const w = Math.round(100 / selected.length * 10) / 10;
    const withWeights = selected.map(h => ({ ...h, weight: w }));
    onImport(withWeights);
    handleClose();
  }, [parsedHoldings, excluded, onImport]);

  // ── Close & reset ──────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    onClose();
    setParsedHoldings(null);
    setRawText('');
    setError(null);
    setExcluded(new Set());
    setIsParsing(false);
  }, [onClose]);

  if (!open) return null;

  const selectedCount = parsedHoldings ? parsedHoldings.length - excluded.size : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-extrabold text-text-main">Importer un portefeuille</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-130px)]">
          {/* ── Input mode ────────────────────────────────────────── */}
          {!parsedHoldings && (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => setMode('paste')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    mode === 'paste'
                      ? 'bg-[#1CB0F6]/10 text-[#1CB0F6] ring-2 ring-[#1CB0F6]/20'
                      : 'bg-gray-50 text-text-muted hover:bg-gray-100'
                  }`}
                >
                  <ClipboardPaste className="h-4 w-4" />
                  Coller du texte
                </button>
                <button
                  onClick={() => setMode('file')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    mode === 'file'
                      ? 'bg-[#1CB0F6]/10 text-[#1CB0F6] ring-2 ring-[#1CB0F6]/20'
                      : 'bg-gray-50 text-text-muted hover:bg-gray-100'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Fichier / Photo
                </button>
              </div>

              {/* Paste mode */}
              {mode === 'paste' && (
                <div className="space-y-3">
                  <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder={`Collez ici le contenu d'un relevé, fichier Excel, CSV ou liste de titres...\n\nExemples de formats supportés :\n  RY.TO  25%   ENB.TO  15%   XIC.TO  30%\n  AAPL, 100, 185.50\n  Texte copié d'un relevé bancaire`}
                    className="w-full h-44 px-4 py-3 rounded-xl bg-gray-50 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/30 resize-none font-mono"
                    style={{ border: '2px solid #e5e7eb' }}
                  />
                  <button
                    onClick={() => rawText.trim() && parseText(rawText)}
                    disabled={!rawText.trim() || isParsing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm text-white transition-all disabled:opacity-50 active:translate-y-[2px]"
                    style={{ backgroundColor: '#1CB0F6', boxShadow: '0 3px 0 0 #1899d6' }}
                  >
                    {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isParsing ? 'Analyse IA en cours...' : "Détecter les positions"}
                  </button>
                </div>
              )}

              {/* File mode */}
              {mode === 'file' && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !isParsing && fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 py-12 rounded-xl cursor-pointer transition-all ${
                    dragOver
                      ? 'bg-[#1CB0F6]/10 border-[#1CB0F6]'
                      : 'bg-gray-50 border-gray-200 hover:border-[#1CB0F6]/50'
                  }`}
                  style={{ border: '2px dashed' }}
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="h-10 w-10 text-[#1CB0F6] animate-spin" />
                      <p className="text-sm font-bold text-text-main">Analyse IA en cours...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-text-muted/40" />
                      <div className="text-center">
                        <p className="text-sm font-bold text-text-main">
                          Glissez un fichier ici ou cliquez
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          Excel (.xlsx), CSV, ou photo de relevé (.jpg, .png)
                        </p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = ''; // reset for re-upload
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* ── Parsed results ────────────────────────────────────── */}
          {parsedHoldings && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Check className="h-5 w-5 text-[#58CC02]" />
                <span className="text-sm font-bold text-text-main">
                  {parsedHoldings.length} position{parsedHoldings.length > 1 ? 's' : ''} détectée{parsedHoldings.length > 1 ? 's' : ''}
                </span>
                {excluded.size > 0 && (
                  <span className="text-xs text-text-muted">
                    ({selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''})
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1">
                {parsedHoldings.map((h, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                      excluded.has(i) ? 'bg-gray-50 opacity-50' : 'bg-[#58CC02]/5'
                    }`}
                    onClick={() => toggleExclude(i)}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 ${
                      excluded.has(i) ? 'border-gray-300 bg-white' : 'border-[#58CC02] bg-[#58CC02]'
                    }`}>
                      {!excluded.has(i) && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-xs font-extrabold text-text-main w-20 flex-shrink-0">{h.symbol}</span>
                    <span className="text-xs text-text-muted flex-1 truncate">{h.name}</span>
                    {(h.quantity ?? 0) > 0 && (
                      <span className="text-[10px] text-text-muted flex-shrink-0">
                        {h.quantity} un. {h.marketPrice ? `@ $${h.marketPrice.toFixed(2)}` : ''}
                      </span>
                    )}
                    {excluded.has(i) && (
                      <Trash2 className="h-3.5 w-3.5 text-text-muted/50 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setParsedHoldings(null); setError(null); setExcluded(new Set()); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-text-muted bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Recommencer
                </button>
                <button
                  onClick={confirmImport}
                  disabled={selectedCount === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-sm text-white transition-all disabled:opacity-50 active:translate-y-[2px]"
                  style={{ backgroundColor: '#58CC02', boxShadow: '0 3px 0 0 #45a300' }}
                >
                  <Check className="h-4 w-4" />
                  Importer ({selectedCount})
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 mt-3">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-700">{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
