"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface StockRef {
  symbol: string;
  name: string;
  market?: string;
}

interface WatchlistCtx {
  favorites: StockRef[];
  isFavorite: (symbol: string) => boolean;
  toggleFavorite: (stock: StockRef) => void;
  recent: StockRef[];
  recordView: (stock: StockRef) => void;
}

const WatchlistContext = createContext<WatchlistCtx>({
  favorites: [],
  isFavorite: () => false,
  toggleFavorite: () => {},
  recent: [],
  recordView: () => {},
});

export const useWatchlist = () => useContext(WatchlistContext);

const FAV_KEY = "stockAnalyzer:favorites";
const RECENT_KEY = "stockAnalyzer:recent";
const RECENT_MAX = 20;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<StockRef[]>([]);
  const [recent, setRecent] = useState<StockRef[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // localStorage는 클라이언트 마운트 후에만 읽는다 (SSR 하이드레이션 불일치 방지)
  useEffect(() => {
    setFavorites(loadJSON(FAV_KEY, []));
    setRecent(loadJSON(RECENT_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }, [recent, hydrated]);

  const isFavorite = useCallback(
    (symbol: string) => favorites.some((f) => f.symbol === symbol),
    [favorites]
  );

  const toggleFavorite = useCallback((stock: StockRef) => {
    setFavorites((prev) =>
      prev.some((f) => f.symbol === stock.symbol)
        ? prev.filter((f) => f.symbol !== stock.symbol)
        : [stock, ...prev]
    );
  }, []);

  const recordView = useCallback((stock: StockRef) => {
    setRecent((prev) => [stock, ...prev.filter((r) => r.symbol !== stock.symbol)].slice(0, RECENT_MAX));
  }, []);

  return (
    <WatchlistContext.Provider value={{ favorites, isFavorite, toggleFavorite, recent, recordView }}>
      {children}
    </WatchlistContext.Provider>
  );
}
