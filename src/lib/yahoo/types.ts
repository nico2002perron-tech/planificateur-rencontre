import type { YahooNewsItem } from './client';

export interface SymbolNews {
  symbol: string;
  articles: YahooNewsItem[];
  hasEarnings: boolean;
  hasNews: boolean;
}

export interface NewsResponse {
  news: Record<string, SymbolNews>;
}

export interface TranslateResponse {
  translated: string;
}
