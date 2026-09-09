"use client";

import { useEffect } from "react";
import { useWatchlist, StockRef } from "@/contexts/WatchlistContext";

export default function RecordRecentView({ stock }: { stock: StockRef }) {
  const { recordView } = useWatchlist();

  useEffect(() => {
    recordView(stock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.symbol]);

  return null;
}
