export const getCategoryFromArticle = (article: {
    title: string;
    description: string;
    source: string;
  }): string => {
    const title = (article.title || '').toLowerCase();
    const description = (article.description || '').toLowerCase();
    const source = (article.source || '').toLowerCase();
    const text = `${title} ${description}`;
  
    const regulationKeywords = ['regulation', 'regulatory', 'sec', 'compliance', 'law', 'legal', 'government', 'policy', 'ban', 'lawsuit'];
    if (regulationKeywords.some(keyword => text.includes(keyword))) {
      return 'regulation';
    }
  
    const techKeywords = ['blockchain', 'technology', 'protocol', 'layer 2', 'defi', 'nft', 'smart contract', 'upgrade', 'network', 'infrastructure'];
    if (techKeywords.some(keyword => text.includes(keyword))) {
      return 'technology';
    }
  
    if (source.includes('coindesk') || source.includes('cryptonews') || source.includes('cointelegraph') ||
        text.includes('bitcoin') || text.includes('ethereum') || text.includes('crypto')) {
      return 'crypto';
    }
  
    if (source.includes('fxstreet') || source.includes('investing') || source.includes('yahoo')) {
      return 'markets';
    }
  
    return 'crypto';
  };
  
  export const getPlaceholderImage = (category: string, index: number): string => {
    const cryptoImages = [
      'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1640826514546-7d2d259a2f6c?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1644088379091-d574269d422f?w=800&q=80&fit=crop',
    ];
  
    const marketImages = [
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800&q=80&fit=crop',
    ];
  
    const techImages = [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&q=80&fit=crop',
    ];
  
    const regulationImages = [
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80&fit=crop',
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80&fit=crop',
    ];
  
    let images = cryptoImages;
    if (category === 'markets') images = marketImages;
    else if (category === 'technology') images = techImages;
    else if (category === 'regulation') images = regulationImages;
  
    return images[index % images.length];
  };
  
  export const formatTimestamp = (timestamp: string): string => {
    if (!timestamp) return 'Recently';
  
    const publishedDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - publishedDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
  
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return publishedDate.toLocaleDateString();
  };