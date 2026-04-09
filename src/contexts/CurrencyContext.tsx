import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export type CurrencyCode = "USD" | "EUR" | "INR";

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  rates: Record<CurrencyCode, number>;
  formatValue: (usdValue: number | null | undefined) => string;
  toUSD: (localValue: number) => number;
  symbol: string;
  loading: boolean;
}

const SYMBOLS: Record<CurrencyCode, string> = { USD: "$", EUR: "€", INR: "₹" };
const LOCALES: Record<CurrencyCode, string> = { USD: "en-US", EUR: "de-DE", INR: "en-IN" };

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  rates: { USD: 1, EUR: 0.92, INR: 83.5 },
  formatValue: () => "",
  toUSD: (v) => v,
  symbol: "$",
  loading: false,
});

export const useCurrency = () => useContext(CurrencyContext);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    return (localStorage.getItem("crm-currency") as CurrencyCode) || "USD";
  });
  const [rates, setRates] = useState<Record<CurrencyCode, number>>({ USD: 1, EUR: 0.92, INR: 83.5 });
  const [loading, setLoading] = useState(true);

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem("crm-currency", c);
  };

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-rates`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.rates) setRates(data.rates);
        }
      } catch (e) {
        console.error("Failed to fetch exchange rates:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchRates();
  }, []);

  const formatValue = useCallback(
    (value: number | null | undefined): string => {
      if (value == null) return "";
      return `${SYMBOLS[currency]}${value.toLocaleString(LOCALES[currency], {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`;
    },
    [currency]
  );

  const toUSD = useCallback(
    (localValue: number): number => {
      if (rates[currency] === 0) return localValue;
      return localValue / rates[currency];
    },
    [currency, rates]
  );

  const symbol = SYMBOLS[currency];

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, formatValue, toUSD, symbol, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}
