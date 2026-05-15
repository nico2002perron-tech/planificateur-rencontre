'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PROFESSIONS, CITIES_QC } from '@/lib/prospection/types';
import { Search, Loader2, CheckCircle, AlertTriangle, Plus } from 'lucide-react';

export default function SearchPage() {
  const [profession, setProfession] = useState('');
  const [city, setCity] = useState('');
  const [maxResults, setMaxResults] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ scraped: number; inserted: number; duplicates: number } | null>(null);
  const [error, setError] = useState('');

  // Manual add
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ name: '', phone: '', profession: '', city: '', business_name: '' });
  const [manualMsg, setManualMsg] = useState('');

  async function handleScrape() {
    if (!profession || !city) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/prospection/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profession, city, max_results: maxResults }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur de scraping');
      } else {
        setResult(data);
      }
    } catch {
      setError('Erreur de connexion');
    }
    setLoading(false);
  }

  async function handleManualAdd() {
    if (!manual.name || !manual.phone) return;
    setManualMsg('');
    try {
      const res = await fetch('/api/prospection/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manual),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualMsg(data.error || 'Erreur');
      } else {
        setManualMsg('Lead ajouté avec succès');
        setManual({ name: '', phone: '', profession: '', city: '', business_name: '' });
      }
    } catch {
      setManualMsg('Erreur de connexion');
    }
  }

  return (
    <div>
      <PageHeader title="Recherche de leads" description="Scrapez des répertoires ou ajoutez manuellement" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scraper */}
        <Card>
          <CardTitle>Scraper Pages Jaunes</CardTitle>
          <p className="text-sm text-text-muted mb-4">
            Recherche automatique de professionnels avec numéro de téléphone. Maximum 50 résultats par recherche.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Profession</label>
              <select
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              >
                <option value="">Sélectionner...</option>
                {PROFESSIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="custom">Autre (personnalisé)</option>
              </select>
              {profession === 'custom' && (
                <input
                  type="text"
                  placeholder="Entrez la profession..."
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                  onChange={(e) => setProfession(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Ville</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              >
                <option value="">Sélectionner...</option>
                {CITIES_QC.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Nombre max de résultats ({maxResults})
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full accent-[var(--brand-primary)]"
              />
              <div className="flex justify-between text-xs text-text-light">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full"
              icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              disabled={loading || !profession || !city}
              onClick={handleScrape}
            >
              {loading ? 'Scraping en cours...' : 'Lancer la recherche'}
            </Button>

            {loading && (
              <p className="text-xs text-text-muted text-center">
                Cela peut prendre quelques minutes (délai entre chaque requête)...
              </p>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {result && (
              <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Scraping terminé</span>
                </div>
                <ul className="space-y-0.5 ml-6">
                  <li>{result.scraped} résultats trouvés</li>
                  <li>{result.inserted} nouveaux leads ajoutés</li>
                  {result.duplicates > 0 && <li>{result.duplicates} doublons ignorés</li>}
                </ul>
              </div>
            )}
          </div>
        </Card>

        {/* Manual add */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Ajouter manuellement</CardTitle>
            <Badge variant="outline">Référence / Réseautage</Badge>
          </div>
          <p className="text-sm text-text-muted mb-4">
            Ajoutez un lead manuellement depuis un événement, une référence ou LinkedIn.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Nom *</label>
              <input
                type="text"
                value={manual.name}
                onChange={(e) => setManual({ ...manual, name: e.target.value })}
                placeholder="Jean Tremblay"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Téléphone *</label>
              <input
                type="tel"
                value={manual.phone}
                onChange={(e) => setManual({ ...manual, phone: e.target.value })}
                placeholder="(418) 555-1234"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Profession</label>
              <input
                type="text"
                value={manual.profession}
                onChange={(e) => setManual({ ...manual, profession: e.target.value })}
                placeholder="Dentiste"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Entreprise</label>
              <input
                type="text"
                value={manual.business_name}
                onChange={(e) => setManual({ ...manual, business_name: e.target.value })}
                placeholder="Clinique Dentaire Tremblay"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Ville</label>
              <input
                type="text"
                value={manual.city}
                onChange={(e) => setManual({ ...manual, city: e.target.value })}
                placeholder="Québec"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>

            <Button
              variant="primary"
              className="w-full"
              icon={<Plus className="h-4 w-4" />}
              disabled={!manual.name || !manual.phone}
              onClick={handleManualAdd}
            >
              Ajouter le lead
            </Button>

            {manualMsg && (
              <p className={`text-sm text-center ${manualMsg.includes('succès') ? 'text-green-600' : 'text-red-600'}`}>
                {manualMsg}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
