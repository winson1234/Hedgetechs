import { useState, useEffect } from 'react';

export interface ProductType {
  value: string;
  label: string;
  description: string;
}

interface ConfigData {
  currencies: string[];
  productTypes: ProductType[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch configuration data from backend API
 * Provides currencies and product types with caching
 */
export function useConfig(): ConfigData {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch currencies and product types in parallel
        const [currenciesRes, productTypesRes] = await Promise.all([
          fetch('/api/v1/config/currencies'),
          fetch('/api/v1/config/product-types'),
        ]);

        if (!currenciesRes.ok || !productTypesRes.ok) {
          throw new Error('Failed to fetch configuration data');
        }

        const currenciesData = await currenciesRes.json();
        const productTypesData = await productTypesRes.json();

        if (isMounted) {
          setCurrencies(currenciesData.currencies || []);
          setProductTypes(productTypesData.product_types || []);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error occurred');
          setLoading(false);
        }
      }
    };

    void fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    currencies,
    productTypes,
    loading,
    error,
  };
}
