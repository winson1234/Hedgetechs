import { useState, useEffect } from 'react';
import { getApiUrl } from '../../../config/api';
import { NewsItem } from '../types/dashboard';
import { getCategoryFromArticle, getPlaceholderImage, formatTimestamp } from '../utils/newsHelpers';

export const useNews = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true);

        const response = await fetch(getApiUrl('/api/v1/news'));

        if (!response.ok) {
          console.error('Failed to fetch news');
          return;
        }

        const newsData = await response.json() as {
          articles: Array<{
            title: string;
            description: string;
            source: string;
            pubDate: string;
            publishedAt?: string;
            link: string;
          }>;
        };

        const articles = newsData.articles || [];

        const transformedNews = articles.map((article, index: number) => {
          const category = getCategoryFromArticle(article);
          return {
            id: index + 1,
            title: article.title,
            excerpt: article.description || article.title,
            source: article.source,
            category: category,
            timestamp: formatTimestamp(article.pubDate || article.publishedAt || ''),
            featured: index === 0,
            image: getPlaceholderImage(category, index),
            link: article.link,
          };
        });

        setNewsItems(transformedNews);
      } catch (err) {
        console.error('Error fetching news:', err);
      } finally {
        setNewsLoading(false);
      }
    };

    fetchNews();

    const interval = setInterval(fetchNews, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { newsItems, newsLoading };
};