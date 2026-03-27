'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useStockUniverse, type UniverseStock } from '@/lib/hooks/useStockUniverse';
import { useBondsUniverse, type UniverseBond } from '@/lib/hooks/useBondsUniverse';
import { SECTORS } from '@/lib/utils/constants';
import { StepNav } from '@/components/models/StepNav';
import {
  ArrowLeft, Plus, Trash2, Upload, Search, GripVertical,
  ChevronDown, ChevronRight, FileSpreadsheet, X,
} from 'lucide-react';

// ── Onglets ──
type Tab = 'actions' | 'obligations';

export default function UniversePage() {
  const [tab, setTab] = useState<Tab>('actions');

  return (
    <div>
      <PageHeader
        title="Univers de titres"
        description="Actions et obligations disponibles pour la construction des portefeuilles modeles"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('actions')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'actions'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Actions
        </button>
        <button
          onClick={() => setTab('obligations')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'obligations'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Obligations
        </button>
      </div>

      {tab === 'actions' ? <StocksTab /> : <BondsTab />}

      <StepNav current={2} />
    </div>
  );
}

// ════════════════════════════════════════════════
// ONGLET ACTIONS
// ════════════════════════════════════════════════

function StocksTab() {
  const { stocks, bySector, sectors, isLoading, mutate } = useStockUniverse();
  const { toast } = useToast();
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set(sectors));
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; exchange: string; type: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Recherche TradingView
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 250);
  }, []);

  // Ajouter un titre
  const [addForm, setAddForm] = useState<{ symbol: string; name: string; sector: string; stock_type: 'obligatoire' | 'variable'; position: number }>({ symbol: '', name: '', sector: sectors[0] || 'TECHNOLOGY', stock_type: 'variable', position: 99 });

  async function handleAddStock() {
    if (!addForm.symbol || !addForm.name || !addForm.sector) {
      toast('warning', 'Remplissez tous les champs');
      return;
    }
    try {
      const res = await fetch('/api/models/universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast('success', `${addForm.symbol} ajouté`);
      setShowAdd(false);
      setAddForm({ symbol: '', name: '', sector: sectors[0] || 'TECHNOLOGY', stock_type: 'variable', position: 99 });
      setSearchQuery('');
      setSearchResults([]);
      mutate();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    }
  }

  // Supprimer un titre
  async function handleDeleteStock(stock: UniverseStock) {
    try {
      const res = await fetch('/api/models/universe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stock.id }),
      });
      if (!res.ok) throw new Error();
      toast('success', `${stock.symbol} retiré`);
      mutate();
    } catch {
      toast('error', 'Erreur lors de la suppression');
    }
  }

  // Toggle type obligatoire/variable
  async function handleToggleType(stock: UniverseStock) {
    const newType = stock.stock_type === 'obligatoire' ? 'variable' : 'obligatoire';
    try {
      await fetch('/api/models/universe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks: [{ id: stock.id, stock_type: newType }] }),
      });
      mutate();
    } catch {
      toast('error', 'Erreur');
    }
  }

  function toggleSector(sector: string) {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {stocks.length} titre{stocks.length !== 1 ? 's' : ''} dans {sectors.length} secteur{sectors.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAdd(true)}>
          Ajouter un titre
        </Button>
      </div>

      {/* Secteurs */}
      {sectors.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-sm text-text-muted mb-4">Aucun titre dans l'univers. Ajoutez vos premiers titres pour commencer.</p>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAdd(true)}>
            Ajouter un titre
          </Button>
        </Card>
      ) : (
        sectors.map(sector => {
          const sectorStocks = bySector[sector] || [];
          const obligatoires = sectorStocks.filter(s => s.stock_type === 'obligatoire');
          const variables = sectorStocks.filter(s => s.stock_type === 'variable');
          const isExpanded = expandedSectors.has(sector);
          const sectorLabel = SECTORS.find(s => s.value === sector)?.label || sector;

          return (
            <Card key={sector} padding="none">
              {/* En-tête secteur */}
              <button
                onClick={() => toggleSector(sector)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
                  <span className="font-semibold text-text-main">{sectorLabel}</span>
                  <Badge variant="outline">{sectorStocks.length} titre{sectorStocks.length !== 1 ? 's' : ''}</Badge>
                  {obligatoires.length > 0 && (
                    <Badge variant="info">{obligatoires.length} oblig.</Badge>
                  )}
                </div>
              </button>

              {/* Tableau des titres */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-text-muted uppercase tracking-wider">
                        <th className="px-5 py-2 w-8"></th>
                        <th className="px-3 py-2">Symbole</th>
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2 text-center">Type</th>
                        <th className="px-3 py-2 text-center">Position</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorStocks.map(stock => (
                        <tr key={stock.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-2.5">
                            <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                          </td>
                          <td className="px-3 py-2.5 font-mono font-medium text-text-main">
                            {stock.symbol}
                          </td>
                          <td className="px-3 py-2.5 text-text-muted">{stock.name}</td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => handleToggleType(stock)}>
                              <Badge variant={stock.stock_type === 'obligatoire' ? 'info' : 'default'}>
                                {stock.stock_type === 'obligatoire' ? 'Obligatoire' : 'Variable'}
                              </Badge>
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-text-muted">
                            {stock.position}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => handleDeleteStock(stock)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })
      )}

      {/* Modal ajout */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setSearchQuery(''); setSearchResults([]); }} title="Ajouter un titre" size="md">
        <div className="space-y-4">
          {/* Recherche */}
          <div className="relative">
            <label className="block text-sm font-medium text-text-main mb-1">Rechercher un titre</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Ex: MSFT, RY.TO, AAPL..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
              {searching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
            </div>

            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {searchResults.map(r => (
                  <button
                    key={r.symbol}
                    onClick={() => {
                      setAddForm(f => ({ ...f, symbol: r.symbol, name: r.name }));
                      setSearchQuery(r.symbol);
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-mono font-medium">{r.symbol}</span>
                      <span className="text-text-muted ml-2">{r.name}</span>
                    </div>
                    <Badge variant="outline">{r.exchange}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Symbole et nom (pré-remplis par la recherche) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Symbole</label>
              <input
                type="text"
                value={addForm.symbol}
                onChange={(e) => setAddForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Nom</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Secteur */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Secteur</label>
            <select
              value={addForm.sector}
              onChange={(e) => setAddForm(f => ({ ...f, sector: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            >
              {SECTORS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Type et position */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Type</label>
              <select
                value={addForm.stock_type}
                onChange={(e) => setAddForm(f => ({ ...f, stock_type: e.target.value as 'obligatoire' | 'variable' }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              >
                <option value="variable">Variable</option>
                <option value="obligatoire">Obligatoire</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Position (priorite)</label>
              <input
                type="number"
                min={1}
                value={addForm.position}
                onChange={(e) => setAddForm(f => ({ ...f, position: parseInt(e.target.value) || 99 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowAdd(false); setSearchQuery(''); setSearchResults([]); }}>Annuler</Button>
            <Button onClick={handleAddStock}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════
// ONGLET OBLIGATIONS
// ════════════════════════════════════════════════

function BondsTab() {
  const { bonds, stats, isLoading, mutate } = useBondsUniverse();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [showAddBond, setShowAddBond] = useState(false);
  const [filter, setFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Excel
  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/models/bonds/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast('success', `${data.stats.inserted} obligations importees depuis ${data.fileName}`);
      mutate();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur d\'import');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Ajout manuel
  const [bondForm, setBondForm] = useState({
    description: '', issuer: '', cusip: '', coupon: '',
    maturity: '', price: '', yield: '', category: '', source: 'MANUAL' as const,
    is_mandatory: false,
  });

  async function handleAddBond() {
    if (!bondForm.description && !bondForm.cusip) {
      toast('warning', 'Description ou CUSIP requis');
      return;
    }
    try {
      const res = await fetch('/api/models/bonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bondForm,
          coupon: bondForm.coupon ? parseFloat(bondForm.coupon) : null,
          price: bondForm.price ? parseFloat(bondForm.price) : null,
          yield: bondForm.yield ? parseFloat(bondForm.yield) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast('success', 'Obligation ajoutee');
      setShowAddBond(false);
      setBondForm({ description: '', issuer: '', cusip: '', coupon: '', maturity: '', price: '', yield: '', category: '', source: 'MANUAL', is_mandatory: false });
      mutate();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    }
  }

  // Supprimer
  async function handleDeleteBond(bond: UniverseBond) {
    try {
      await fetch('/api/models/bonds', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bond.id }),
      });
      toast('success', 'Obligation retirée');
      mutate();
    } catch {
      toast('error', 'Erreur');
    }
  }

  // Toggle obligatoire
  async function handleToggleMandatory(bond: UniverseBond) {
    try {
      await fetch('/api/models/bonds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bond.id, is_mandatory: !bond.is_mandatory }),
      });
      mutate();
    } catch {
      toast('error', 'Erreur');
    }
  }

  const filteredBonds = filter
    ? bonds.filter(b =>
        b.description?.toLowerCase().includes(filter.toLowerCase()) ||
        b.issuer?.toLowerCase().includes(filter.toLowerCase()) ||
        b.cusip?.toLowerCase().includes(filter.toLowerCase())
      )
    : bonds;

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total },
          { label: 'CAD', value: stats.cad },
          { label: 'US', value: stats.us },
          { label: 'Manuel', value: stats.manual },
          { label: 'Obligatoires', value: stats.mandatory },
        ].map(s => (
          <Card key={s.label} padding="sm" className="text-center">
            <p className="text-2xl font-semibold text-text-main">{s.value}</p>
            <p className="text-xs text-text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Barre d'actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer par description, emetteur ou CUSIP..."
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>
        <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddBond(true)}>
          Ajouter
        </Button>
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            onChange={handleImportExcel}
            className="hidden"
          />
          <Button
            size="sm"
            loading={importing}
            icon={<Upload className="h-3.5 w-3.5" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Importer Excel
          </Button>
        </div>
      </div>

      {/* Info import */}
      {bonds.length === 0 && (
        <Card className="text-center py-10">
          <FileSpreadsheet className="h-12 w-12 text-text-light mx-auto mb-3" />
          <h3 className="font-semibold text-text-main mb-1">Aucune obligation</h3>
          <p className="text-sm text-text-muted mb-4 max-w-md mx-auto">
            Importez vos fichiers Bonds CAD.xlsm ou Bonds US.xlsm pour remplir l'univers d'obligations.
            Le systeme detecte automatiquement les CUSIP, coupons, echeances et prix.
          </p>
          <Button
            icon={<Upload className="h-4 w-4" />}
            onClick={() => fileInputRef.current?.click()}
            loading={importing}
          >
            Importer un fichier Excel
          </Button>
        </Card>
      )}

      {/* Tableau des obligations */}
      {filteredBonds.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-2.5">Emetteur</th>
                  <th className="px-3 py-2.5">CUSIP</th>
                  <th className="px-3 py-2.5 text-right">Coupon</th>
                  <th className="px-3 py-2.5">Echeance</th>
                  <th className="px-3 py-2.5 text-right">Prix</th>
                  <th className="px-3 py-2.5 text-right">Yield</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Categorie</th>
                  <th className="px-3 py-2.5 text-center">Oblig.</th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredBonds.slice(0, 200).map(bond => (
                  <tr key={bond.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-text-main max-w-[200px] truncate" title={bond.issuer || bond.description}>
                      {bond.issuer || bond.description}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-muted text-xs">{bond.cusip || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{bond.coupon != null ? `${bond.coupon}%` : '—'}</td>
                    <td className="px-3 py-2 text-text-muted">
                      {bond.maturity ? new Date(bond.maturity).toLocaleDateString('fr-CA') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{bond.price != null ? bond.price.toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{bond.yield != null ? `${bond.yield}%` : '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={bond.source === 'CAD' ? 'info' : bond.source === 'US' ? 'warning' : 'default'}>
                        {bond.source}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-text-muted text-xs">{bond.category || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleToggleMandatory(bond)}>
                        <Badge variant={bond.is_mandatory ? 'success' : 'outline'}>
                          {bond.is_mandatory ? 'Oui' : 'Non'}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDeleteBond(bond)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBonds.length > 200 && (
              <p className="text-xs text-text-muted text-center py-3 border-t border-gray-100">
                Affichage limite a 200 / {filteredBonds.length} obligations. Utilisez le filtre pour preciser.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Modal ajout manuel */}
      <Modal open={showAddBond} onClose={() => setShowAddBond(false)} title="Ajouter une obligation" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Description</label>
            <input
              type="text"
              value={bondForm.description}
              onChange={(e) => setBondForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ex: HEB CB 5.82% 13AU29"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Emetteur</label>
              <input type="text" value={bondForm.issuer} onChange={(e) => setBondForm(f => ({ ...f, issuer: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">CUSIP</label>
              <input type="text" value={bondForm.cusip} onChange={(e) => setBondForm(f => ({ ...f, cusip: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Coupon (%)</label>
              <input type="number" step="0.01" value={bondForm.coupon} onChange={(e) => setBondForm(f => ({ ...f, coupon: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Prix</label>
              <input type="number" step="0.01" value={bondForm.price} onChange={(e) => setBondForm(f => ({ ...f, price: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Yield (%)</label>
              <input type="number" step="0.01" value={bondForm.yield} onChange={(e) => setBondForm(f => ({ ...f, yield: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Echeance</label>
              <input type="date" value={bondForm.maturity} onChange={(e) => setBondForm(f => ({ ...f, maturity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Categorie</label>
              <input type="text" value={bondForm.category} onChange={(e) => setBondForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Ex: Provincial, Corporate..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mandatory"
              checked={bondForm.is_mandatory}
              onChange={(e) => setBondForm(f => ({ ...f, is_mandatory: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="mandatory" className="text-sm text-text-main">Obligation obligatoire (toujours incluse dans les portefeuilles)</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowAddBond(false)}>Annuler</Button>
            <Button onClick={handleAddBond}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
