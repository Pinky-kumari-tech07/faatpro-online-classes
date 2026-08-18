import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

export type CartItem = {
  key: string;
  productType: "course" | "bundle";
  productId: string;
  slug: string;
  title: string;
  thumbnail?: string | null;
  price: number;
  originalPrice?: number | null;
  currency: string;
  workspaceId: string;
  addedAt: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  add: (item: Omit<CartItem, "key" | "addedAt">) => void;
  remove: (key: string) => void;
  clear: () => void;
  has: (productType: string, productId: string) => boolean;
};

const STORAGE_KEY = "faatpro_cart_v1";
const Ctx = createContext<CartCtx | null>(null);

function load(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("faatpro:cart-updated"));
  } catch {}
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => load());

  useEffect(() => {
    const sync = () => setItems(load());
    window.addEventListener("faatpro:cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("faatpro:cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add: CartCtx["add"] = useCallback((item) => {
    setItems((prev) => {
      const key = `${item.productType}:${item.productId}`;
      if (prev.some((p) => p.key === key)) return prev;
      const next = [...prev, { ...item, key, addedAt: Date.now() }];
      save(next);
      return next;
    });
  }, []);

  const remove: CartCtx["remove"] = useCallback((key) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.key !== key);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    save([]);
  }, []);

  const has: CartCtx["has"] = useCallback(
    (productType, productId) => items.some((p) => p.productType === productType && p.productId === productId),
    [items],
  );

  const value = useMemo<CartCtx>(() => ({ items, count: items.length, add, remove, clear, has }), [items, add, remove, clear, has]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}