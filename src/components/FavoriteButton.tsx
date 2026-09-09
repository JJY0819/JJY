"use client";

import { useWatchlist, StockRef } from "@/contexts/WatchlistContext";

export default function FavoriteButton({ stock }: { stock: StockRef }) {
  const { isFavorite, toggleFavorite } = useWatchlist();
  const active = isFavorite(stock.symbol);

  return (
    <button
      onClick={() => toggleFavorite(stock)}
      aria-label={active ? "관심종목 삭제" : "관심종목 추가"}
      className={`text-2xl leading-none transition-colors ${
        active ? "text-amber-400" : "text-gray-300 hover:text-amber-300"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
