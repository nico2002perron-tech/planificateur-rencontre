'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { parseSmartData, buildParseResultFromAI, createManualHolding, mergeHoldingsIntoResult, type ParseResult, type ParsedHolding } from '@/lib/parsers/smart-parser';
import { ResultsView } from './PretAColler';
import {
  ClipboardPaste, Sparkles, RotateCcw, Plus, Search, X,
  FileSpreadsheet, Upload, Rocket, AlertTriangle, UserPlus,
  ListPlus, Trash2, Check,
} from 'lucide-react';

// ─── Duolingo-style colors ───────────────────────────────────────────────────

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
  red: '#FF4B4B', redDark: '#ea2b2b',
  teal: '#00CD9C', tealDark: '#00b386',
} as const;

// ─── Symbol Search (FMP) ────────────────────────────────────────────────────

interface SearchResult {
  symbol: string;
  name: string;
  currency?: string;
  stockExchange?: string;
  exchangeShortName?: string;
}

function useSymbolSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/fmp/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { query, setQuery, results, loading };
}

// ─── Manual Add Row ─────────────────────────────────────────────────────────

interface ManualEntry {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  cost: number;
  currency: string;
}

function ManualAddSection({
  entries,
  onAdd,
  onRemove,
}: {
  entries: ManualEntry[];
  onAdd: (entry: ManualEntry) => void;
  onRemove: (id: string) => void;
}) {
  const search = useSymbolSearch();
  const [showSearch, setShowSearch] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<SearchResult | null>(null);
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [manualSymbol, setManualSymbol] = useState('');

  const handleSelect = (result: SearchResult) => {
    setSelectedSymbol(result);
    search.setQuery('');
    setShowSearch(false);
  };

  const handleAdd = () => {
    const symbol = selectedSymbol?.symbol || manualSymbol.toUpperCase().trim();
    const name = selectedSymbol?.name || symbol;
    if (!symbol) return;

    onAdd({
      id: `manual_${Date.now()}_${Math.random()}`,
      symbol,
      name,
      quantity: parseFloat(quantity) || 0,
      cost: parseFloat(cost) || 0,
      currency: selectedSymbol?.currency || 'CAD',
    });

    setSelectedSymbol(null);
    setManualSymbol('');
    setQuantity('');
    setCost('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${DUO.orange}15` }}
        >
          <ListPlus className="h-4 w-4" style={{ color: DUO.orange }} />
        </div>
        <div>
          <p className="text-sm font-bold text-text-main">Ajout manuel</p>
          <p className="text-xs text-text-muted">Recherchez ou entrez un symbole directement</p>
        </div>
      </div>

      {/* Search / manual entry */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          {selectedSymbol ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-200">
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="font-mono font-bold text-sm text-emerald-800">{selectedSymbol.symbol}</span>
              <span className="text-xs text-emerald-600 truncate">{selectedSymbol.name}</span>
              <button onClick={() => setSelectedSymbol(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un titre (ex: Apple, ENB, RY...)"
                  value={showSearch ? search.query : manualSymbol}
                  onChange={(e) => {
                    if (showSearch) {
                      search.setQuery(e.target.value);
                    } else {
                      setManualSymbol(e.target.value);
                    }
                  }}
                  onFocus={() => setShowSearch(true)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-[#1CB0F6] focus:ring-2 focus:ring-[#1CB0F6]/20 focus:outline-none transition-all"
                />
                {search.loading && (
                  <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                )}
              </div>
              {showSearch && search.results.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border-2 border-gray-200 shadow-lg max-h-64 overflow-y-auto">
                  {search.results.map((r) => (
                    <button
                      key={r.symbol}
                      onClick={() => handleSelect(r)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-mono font-bold text-xs text-brand-primary w-16">{r.symbol}</span>
                      <span className="text-xs text-text-main truncate flex-1">{r.name}</span>
                      {r.exchangeShortName && (
                        <span className="text-[10px] text-text-muted bg-gray-100 px-1.5 py-0.5 rounded">{r.exchangeShortName}</span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (search.query.trim()) {
                        setManualSymbol(search.query.toUpperCase().trim());
                      }
                      setShowSearch(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors text-xs text-text-muted"
                  >
                    Utiliser &quot;{search.query.toUpperCase()}&quot; tel quel
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <input
          type="number"
          placeholder="Quantité"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-28 px-3 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-[#1CB0F6] focus:ring-2 focus:ring-[#1CB0F6]/20 focus:outline-none text-right tabular-nums"
        />
        <input
          type="number"
          placeholder="Coût unit."
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="w-28 px-3 py-2.5 text-sm rounded-xl border-2 border-gray-200 focus:border-[#1CB0F6] focus:ring-2 focus:ring-[#1CB0F6]/20 focus:outline-none text-right tabular-nums"
        />

        <button
          onClick={handleAdd}
          disabled={!selectedSymbol && !manualSymbol.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold
            transition-all duration-150 active:translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {/* Manual entries list */}
      {entries.length > 0 && (
        <div className="rounded-xl border-2 border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-text-muted text-xs">
                <th className="text-left py-2 px-3 font-semibold">Symbole</th>
                <th className="text-left py-2 px-3 font-semibold">Description</th>
                <th className="text-right py-2 px-3 font-semibold">Quantité</th>
                <th className="text-right py-2 px-3 font-semibold">Coût unit.</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-50">
                  <td className="py-2 px-3 font-mono font-bold text-brand-primary text-xs">{e.symbol}</td>
                  <td className="py-2 px-3 text-xs text-text-main truncate max-w-[200px]">{e.name}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs">{e.quantity || '—'}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs">{e.cost ? `$${e.cost.toFixed(2)}` : '—'}</td>
                  <td className="py-2 px-1">
                    <button onClick={() => onRemove(e.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Smart Input Zone ───────────────────────────────────────────────────────

function SmartInputZone({
  onResult,
  clientName,
  onClientNameChange,
}: {
  onResult: (result: ParseResult) => void;
  clientName: string;
  onClientNameChange: (name: string) => void;
}) {
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textValue, setTextValue] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [activeMode, setActiveMode] = useState<'paste' | 'manual'>('paste');

  const handleAnalyze = useCallback(async (text: string) => {
    if (!text.trim() && manualEntries.length === 0) return;

    let result: ParseResult;

    if (text.trim()) {
      const { result: parsed, needsAI } = parseSmartData(text);

      if (parsed.holdings.length > 0) {
        result = parsed;
      } else if (needsAI) {
        // REPLI IA RETIRE le 7 aout 2026 : cette branche envoyait le texte brut
        // colle -- positions, quantites, valeurs -- a un fournisseur tiers.
        toast('error', MESSAGE_FORMAT_INCONNU);
        setAiParsing(false);
        return;
      } else {
        toast('error', 'Aucune position détectée. Vérifiez le format des données.');
        return;
      }
    } else {
      // Manual entries only
      result = {
        holdings: [],
        detectedHeaders: [],
        warnings: [],
        summary: {
          equities: 0, fixedIncome: 0, etfs: 0, funds: 0, preferred: 0, cash: 0, other: 0,
          totalMarketValue: 0, totalAnnualIncome: 0, currencies: [], accountTypes: [],
        },
      };
    }

    // Merge manual entries
    if (manualEntries.length > 0) {
      const manualHoldings = manualEntries.map(e =>
        createManualHolding(e.symbol, e.name, e.quantity, e.cost, e.currency)
      );
      result = mergeHoldingsIntoResult(result, manualHoldings);
    }

    onResult(result);
  }, [manualEntries, onResult, toast]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (text.trim()) {
      e.preventDefault();
      setTextValue(text);
      handleAnalyze(text);
    }
  }, [handleAnalyze]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // Check for file drop (CSV)
    if (e.dataTransfer.files?.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          if (text) {
            setTextValue(text);
            handleAnalyze(text);
          }
        };
        reader.readAsText(file);
        return;
      }
      toast('error', 'Format non supporté. Utilisez CSV, TSV ou copiez depuis Excel.');
      return;
    }

    // Check for pasted text
    const text = e.dataTransfer.getData('text/plain');
    if (text.trim()) {
      setTextValue(text);
      handleAnalyze(text);
    }
  }, [handleAnalyze, toast]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (text) {
          setTextValue(text);
          handleAnalyze(text);
        }
      };
      reader.readAsText(file);
    } else {
      toast('error', 'Format non supporté. Utilisez CSV, TSV ou copiez depuis Excel.');
    }
    e.target.value = '';
  }, [handleAnalyze, toast]);

  const handleAddEntry = useCallback((entry: ManualEntry) => {
    setManualEntries(prev => [...prev, entry]);
  }, []);

  const handleRemoveEntry = useCallback((id: string) => {
    setManualEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const steps = [
    { num: 1, title: 'Importez', desc: 'Copiez depuis Excel, CSV, ou n\'importe quel format', color: DUO.purple, dark: DUO.purpleDark },
    { num: 2, title: 'Collez ici', desc: 'L\'IA détecte automatiquement les colonnes', color: DUO.blue, dark: DUO.blueDark },
    { num: 3, title: 'Analysez', desc: 'Prix live + cours cibles Yahoo Finance', color: DUO.green, dark: DUO.greenDark },
  ];

  return (
    <div className="space-y-6">
      {/* Step cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((s) => (
          <div
            key={s.num}
            className="relative flex gap-3 items-center p-4 rounded-2xl bg-white transition-transform hover:scale-[1.02]"
            style={{ border: `2px solid ${s.color}30`, borderBottom: `4px solid ${s.dark}40` }}
          >
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-extrabold"
              style={{ backgroundColor: s.color, boxShadow: `0 3px 0 0 ${s.dark}` }}
            >
              {s.num}
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">{s.title}</p>
              <p className="text-xs text-text-muted">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveMode('paste')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeMode === 'paste' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
          }`}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Coller / Importer
        </button>
        <button
          onClick={() => setActiveMode('manual')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeMode === 'manual' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Ajout manuel
          {manualEntries.length > 0 && (
            <span
              className="ml-1 px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
              style={{ backgroundColor: DUO.green }}
            >
              {manualEntries.length}
            </span>
          )}
        </button>
      </div>

      {/* Client name input */}
      {activeMode === 'paste' && (
        <div className="rounded-2xl bg-white border-2 border-gray-200 p-4">
          <label className="block text-sm font-bold text-text-main mb-2">
            Nom du prospect (apparaîtra sur le PDF)
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            placeholder="Ex: Jean Dupont"
            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm
              text-text-main placeholder-text-muted/40
              focus:outline-none focus:ring-2 focus:ring-[#CE82FF]/30 focus:border-[#CE82FF]
              transition-all duration-200"
          />
        </div>
      )}

      {/* Paste / Import zone */}
      {activeMode === 'paste' && (
        <>
          <div
            className={`
              relative rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden
              ${isDragOver ? 'scale-[1.01] ring-4 ring-[#CE82FF]/30' : 'hover:ring-2 hover:ring-[#CE82FF]/20'}
            `}
            style={{
              border: `3px dashed ${isDragOver ? DUO.purple : '#d1d5db'}`,
              background: isDragOver ? `${DUO.purple}08` : 'white',
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => textareaRef.current?.focus()}
          >
            <div className="px-6 pt-8 pb-4 text-center">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-all duration-300"
                style={{
                  backgroundColor: isDragOver ? DUO.purple : `${DUO.purple}15`,
                  color: isDragOver ? 'white' : DUO.purple,
                  boxShadow: isDragOver ? `0 4px 0 0 ${DUO.purpleDark}` : `0 4px 0 0 ${DUO.purpleDark}20`,
                  transform: isDragOver ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-extrabold text-text-main mb-1">
                Collez les positions du prospect
              </h3>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-3">
                Excel, CSV, ou n&apos;importe quel format tabulaire — l&apos;IA s&apos;adapte
              </p>

              {/* Supported formats */}
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {['Excel', 'CSV', 'Relevé courtier', 'Liste de symboles'].map(f => (
                  <span key={f} className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[10px] font-semibold text-text-muted">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="px-6 pb-4">
              <textarea
                ref={textareaRef}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onPaste={handlePaste}
                placeholder={"Ctrl+V pour coller les données...\n\nExemples de formats acceptés:\n• Copier depuis Excel (colonnes: Symbole, Quantité, Prix...)\n• CSV: AAPL,100,150.25\n• Liste simple: AAPL\\nMSFT\\nENB.TO"}
                className="w-full h-36 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-mono
                  text-text-main placeholder-text-muted/40 resize-none
                  focus:outline-none focus:ring-2 focus:ring-[#CE82FF]/30 focus:border-[#CE82FF]
                  transition-all duration-200"
              />
            </div>

            {/* Avertissement confidentialité : si le parseur local échoue, le
                contenu collé/téléversé est envoyé à un service d'IA (Groq) pour
                extraction. On évite donc toute donnée nominative dans ce contenu. */}
            <div className="px-6 pb-2">
              <p className="text-[11px] leading-snug text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Collez <strong>uniquement le tableau des positions</strong> (symboles, quantités, prix).
                N&apos;incluez pas l&apos;entête nominative du relevé, ni une capture d&apos;écran du relevé complet :
                si le format n&apos;est pas reconnu, ce contenu est transmis à un service d&apos;IA pour en extraire les titres.
              </p>
            </div>

            {/* File upload */}
            <div className="px-6 pb-6 flex justify-center">
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer text-xs font-bold text-text-muted hover:text-text-main hover:bg-gray-50 transition-all border-2 border-gray-200">
                <Upload className="h-3.5 w-3.5" />
                Importer un fichier CSV
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* AI parsing indicator */}
          {aiParsing && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-indigo-50 border-2 border-indigo-200">
              <Spinner size="sm" />
              <div>
                <p className="text-sm font-bold text-indigo-900">Analyse IA en cours...</p>
                <p className="text-xs text-indigo-600">Détection automatique des colonnes et des titres</p>
              </div>
              <Sparkles className="h-5 w-5 text-indigo-400 ml-auto animate-pulse" />
            </div>
          )}
        </>
      )}

      {/* Manual add mode */}
      {activeMode === 'manual' && (
        <div
          className="p-5 rounded-2xl bg-white"
          style={{ border: `2px solid ${DUO.orange}25`, borderBottom: `4px solid ${DUO.orangeDark}20` }}
        >
          <ManualAddSection
            entries={manualEntries}
            onAdd={handleAddEntry}
            onRemove={handleRemoveEntry}
          />
        </div>
      )}

      {/* Combined count + analyze button */}
      {(textValue.trim() || manualEntries.length > 0) && !aiParsing && (
        <div className="space-y-3">
          {/* Summary of what will be analyzed */}
          {manualEntries.length > 0 && textValue.trim() && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-blue-700 font-medium">
                Données collées + {manualEntries.length} titre{manualEntries.length > 1 ? 's' : ''} manuel{manualEntries.length > 1 ? 's' : ''} — tout sera combiné
              </span>
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={() => handleAnalyze(textValue)}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-white font-extrabold text-base
                transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
              style={{ backgroundColor: DUO.green, boxShadow: `0 4px 0 0 ${DUO.greenDark}` }}
            >
              <Rocket className="h-5 w-5" />
              Analyser le portefeuille
            </button>
          </div>
        </div>
      )}

      {/* Only manual entries, no text */}
      {manualEntries.length > 0 && !textValue.trim() && activeMode === 'paste' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-200">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="text-xs text-orange-700 font-medium">
            {manualEntries.length} titre{manualEntries.length > 1 ? 's' : ''} ajouté{manualEntries.length > 1 ? 's' : ''} manuellement.
            Collez des données ou passez directement à l&apos;analyse.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const MESSAGE_FORMAT_INCONNU =
  'Format non reconnu. Le repli automatique par IA a été retiré : le texte collé — positions, quantités, valeurs — quittait le poste vers un fournisseur tiers. Collez un export Croesus standard, ou saisissez les positions à la main.';
export function ProspectReport() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [clientName, setClientName] = useState('');

  const handleResult = useCallback((result: ParseResult) => {
    if (result.holdings.length > 0) {
      setParseResult(result);
    }
  }, []);

  const handleReset = useCallback(() => {
    setParseResult(null);
  }, []);

  if (parseResult && parseResult.holdings.length > 0) {
    return <ResultsView result={parseResult} onReset={handleReset} clientName={clientName} />;
  }

  return (
    <div>
      <SmartInputZone onResult={handleResult} clientName={clientName} onClientNameChange={setClientName} />
      {parseResult && parseResult.holdings.length === 0 && parseResult.warnings.length > 0 && (
        <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            {parseResult.warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
