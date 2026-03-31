'use client';

import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { translateText } from '@/lib/hooks/useNews';
import type { YahooNewsItem } from '@/lib/yahoo/client';
import { ExternalLink, Languages } from 'lucide-react';

interface NewsModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  articles: YahooNewsItem[];
  hasEarnings: boolean;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Il y a moins d\u2019une heure';
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

function ArticleCard({ article }: { article: YahooNewsItem }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (translated) {
      setTranslated(null); // toggle back to original
      return;
    }
    setIsTranslating(true);
    const result = await translateText(article.title);
    setTranslated(result);
    setIsTranslating(false);
  }, [article.title, translated]);

  return (
    <div className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug mb-1">
            {translated || article.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{article.publisher}</span>
            {article.publishedAt && (
              <>
                <span className="text-gray-300">&middot;</span>
                <span>{timeAgo(article.publishedAt)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-muted hover:text-[var(--color-primary)]"
            title={translated ? 'Voir l\u2019original' : 'Traduire en fran\u00e7ais'}
          >
            {isTranslating ? (
              <Spinner size="sm" />
            ) : (
              <Languages className="h-4 w-4" />
            )}
          </button>
          {article.link && (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-muted hover:text-[var(--color-primary)]"
              title="Ouvrir l\u2019article"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewsModal({ open, onClose, symbol, articles, hasEarnings }: NewsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Nouvelles — ${symbol}`} size="lg">
      <div className="space-y-3">
        {hasEarnings && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-lg">📊</span>
            <p className="text-sm font-semibold text-amber-800">
              Des résultats financiers (earnings) ont été publiés récemment pour {symbol}
            </p>
          </div>
        )}

        {articles.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">
            Aucune nouvelle récente pour {symbol}.
          </p>
        ) : (
          articles.map((article, i) => (
            <ArticleCard key={article.link || i} article={article} />
          ))
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
