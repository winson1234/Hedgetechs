import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '../config/api';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  published_at: string;
  source: string;
  image_url?: string;
  category: 'crypto' | 'forex' | 'general';
  featured?: boolean;
}

export function useNewsData(refetchInterval: number = 120000) {
  return useQuery({
    queryKey: ['newsData'],
    queryFn: async () => {
      const response = await fetch(getApiUrl('/api/v1/news'));

      if (!response.ok) {
        console.error('Failed to fetch news');
        return [];
      }

      const data = await response.json();

      // Check if articles array exists
      if (!data.articles || !Array.isArray(data.articles)) {
        console.error('Invalid news data structure');
        return [];
      }

      // Helper function to determine category from article
      const getCategoryFromArticle = (article: { source: { name: string }; title: string; description: string }): 'crypto' | 'forex' | 'general' => {
        const text = `${article.title} ${article.description} ${article.source.name}`.toLowerCase();

        const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi', 'nft', 'altcoin', 'binance', 'coinbase', 'solana', 'cardano', 'polygon', 'ripple', 'xrp'];
        const forexKeywords = ['forex', 'fx', 'currency', 'usd', 'eur', 'gbp', 'jpy', 'exchange rate', 'central bank', 'fed', 'ecb', 'dollar', 'euro', 'pound', 'yen'];

        const hasCrypto = cryptoKeywords.some(keyword => text.includes(keyword));
        const hasForex = forexKeywords.some(keyword => text.includes(keyword));

        if (hasCrypto && !hasForex) return 'crypto';
        if (hasForex && !hasCrypto) return 'forex';
        return 'general';
      };

      // Transform API response to match component structure
      const transformedNews: NewsItem[] = data.articles.map((article: {
        title: string;
        description: string;
        link: string;
        pubDate: string;
        source: { name: string };
        image?: string;
      }, index: number) => {
        const category = getCategoryFromArticle(article);
        return {
          id: `${article.source.name}-${index}`,
          title: article.title,
          description: article.description || 'No description available',
          link: article.link,
          published_at: article.pubDate,
          source: article.source.name,
          image_url: article.image,
          category,
          featured: index < 2, // Mark first 2 as featured
        };
      });

      return transformedNews;
    },
    refetchInterval,
    staleTime: 120000, // 2 minutes
    gcTime: 300000, // 5 minutes
  });
}
