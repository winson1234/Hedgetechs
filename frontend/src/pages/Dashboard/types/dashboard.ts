export interface CryptoData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    volume24h: number;
    icon: string;
    gradient: string;
  }
  
  export interface NewsItem {
    id: number;
    title: string;
    excerpt: string;
    source: string;
    category: string;
    timestamp: string;
    featured: boolean;
    image: string;
    link: string;
  }
  
  export interface FAQItem {
    question: string;
    answer: string;
  }
  
  export interface Language {
    code: string;
    name: string;
    flag: string;
  }
  
  export interface PayoutCrypto {
    symbol: string;
    label: string;
    icon: string;
  }
  
  export interface Section {
    id: string;
    name: string;
  }
  
  export interface NavItem {
    id: string;
    label: string;
  }