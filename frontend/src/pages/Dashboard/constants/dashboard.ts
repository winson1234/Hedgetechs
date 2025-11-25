import { PayoutCrypto, Language, FAQItem, NavItem } from '../types/dashboard';

export const PAYOUT_CRYPTOS: readonly PayoutCrypto[] = [
  { symbol: 'BTC', label: 'Bitcoin', icon: '₿' },
  { symbol: 'ETH', label: 'Ethereum', icon: 'Ξ' },
  { symbol: 'SOL', label: 'Solana', icon: '◎' },
  { symbol: 'ADA', label: 'Cardano', icon: '₳' },
  { symbol: 'XRP', label: 'XRP', icon: '✕' },
  { symbol: 'LTC', label: 'Litecoin', icon: 'Ł' },
  { symbol: 'DOGE', label: 'Dogecoin', icon: 'Ð' },
] as const;

export const LANGUAGES: Language[] = [
  { code: 'EN-US', name: 'English (US)', flag: 'https://flagcdn.com/w20/us.png' },
  { code: 'EN-UK', name: 'English (UK)', flag: 'https://flagcdn.com/w20/gb.png' },
  { code: 'ES', name: 'Spanish', flag: 'https://flagcdn.com/w20/es.png' },
  { code: 'FR', name: 'French', flag: 'https://flagcdn.com/w20/fr.png' },
  { code: 'DE', name: 'German', flag: 'https://flagcdn.com/w20/de.png' },
  { code: 'CN', name: 'Chinese', flag: 'https://flagcdn.com/w20/cn.png' },
  { code: 'JP', name: 'Japanese', flag: 'https://flagcdn.com/w20/jp.png' },
  { code: 'KR', name: 'Korean', flag: 'https://flagcdn.com/w20/kr.png' },
];

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How do I verify my identity (KYC)?',
    answer: 'Go to Account Settings → Verification, and upload your ID (passport or national ID) along with a selfie. Once submitted, our system will process it within 24–48 hours. You\'ll receive an email once your verification is approved or if additional documents are required.'
  },
  {
    question: 'How do I deposit funds into my account?',
    answer: 'To deposit, go to Wallet → Deposit, select your preferred currency and payment method, then follow the on-screen instructions. Supported methods include bank transfer, credit/debit card, and crypto deposits. Deposits are typically processed instantly, depending on your payment provider.'
  },
  {
    question: 'How do I place a trade?',
    answer: 'Navigate to the Trading Page, select your desired instrument (e.g., BTC/USD), and choose between Market or Limit Order. Enter your trade size, set optional Take Profit and Stop Loss levels, then confirm the order. Once executed, you can monitor open positions from your Positions tab.'
  },
  {
    question: 'Can I transfer funds between my trading accounts?',
    answer: 'Yes. Go to Wallet → Transfer, choose the source and destination accounts, specify the amount, and confirm. Transfers between internal wallets are instant and free of charge.'
  },
  {
    question: 'How can I contact customer support?',
    answer: 'You can reach our support team via Live Chat or Email at support@hedgetechs.com. Our team is available 24/7 to assist with any account, trading, or technical inquiries.'
  },
];

export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { id: 'market', label: 'Markets' },
  { id: 'news', label: 'News' },
  { id: 'exchange', label: 'Exchange' },
  { id: 'features', label: 'Features' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' }
] as const;

export const SECTIONS = [
  { id: 'home', name: 'Hero' },
  { id: 'market', name: 'Markets' },
  { id: 'news', name: 'News' },
  { id: 'exchange', name: 'Exchange' },
  { id: 'features', name: 'Features' },
  { id: 'about', name: 'About' },
  { id: 'faq', name: 'FAQ' },
  { id: 'footer', name: 'Footer' }
];