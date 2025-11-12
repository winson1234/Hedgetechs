// Application constants for currencies and product types

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'] as const;

export interface ProductType {
  value: 'spot' | 'cfd' | 'futures';
  label: string;
  description: string;
}

export const PRODUCT_TYPES: ProductType[] = [
  {
    value: 'spot',
    label: 'Spot Trading',
    description: 'Buy and sell assets at current market prices with immediate settlement'
  },
  {
    value: 'cfd',
    label: 'CFD Trading',
    description: 'Trade contracts for difference with leverage, without owning the underlying asset'
  },
  {
    value: 'futures',
    label: 'Futures Trading',
    description: 'Trade standardized contracts for future delivery with leverage'
  }
];
