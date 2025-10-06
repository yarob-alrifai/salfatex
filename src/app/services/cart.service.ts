import { Injectable, computed, signal } from '@angular/core';
import { CartItem, CartSnapshot } from '../models/cart.models';
import { Product } from '../models/catalog.models';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly storageKey = 'salfatex-cart';
  private readonly isBrowser =
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  private readonly itemsSignal = signal<CartItem[]>(this.loadInitialItems());

  readonly items = computed(() => [...this.itemsSignal()]);
  readonly totalQuantity = computed(() =>
    this.itemsSignal().reduce((total, item) => total + item.quantity, 0)
  );
  readonly totalPrice = computed(() =>
    this.itemsSignal().reduce((total, item) => total + item.quantity * item.product.price, 0)
  );

  addItem(product: Product, quantity = 1): void {
    if (quantity <= 0) {
      return;
    }

    const items = this.itemsSignal();
    const existingIndex = items.findIndex((item) => item.product.id === product.id);

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + quantity,
      };
      this.setItems(updated);
      return;
    }

    this.setItems([...items, { product, quantity }]);
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(productId);
      return;
    }

    const updated = this.itemsSignal().map((item) =>
      item.product.id === productId ? { ...item, quantity } : item
    );
    this.setItems(updated);
  }

  removeItem(productId: string): void {
    const updated = this.itemsSignal().filter((item) => item.product.id !== productId);
    this.setItems(updated);
  }

  clear(): void {
    this.setItems([]);
  }

  createSnapshot(): CartSnapshot {
    const items = this.items();
    return {
      items: items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          name: { ...item.product.name },
          description: { ...item.product.description },
          materials: item.product.materials ? { ...item.product.materials } : undefined,
          features: item.product.features
            ? item.product.features.map((feature) => ({ ...feature }))
            : undefined,
          //   images: [...item.product.images],
        },
      })),
      total: items.reduce((total, item) => total + item.quantity * item.product.price, 0),
    };
  }

  private setItems(items: CartItem[]): void {
    this.itemsSignal.set(items);
    this.persist(items);
  }

  private loadInitialItems(): CartItem[] {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as CartItem[];
      return Array.isArray(parsed)
        ? parsed.filter((item) => item && item.product && item.product.id && item.quantity > 0)
        : [];
    } catch {
      return [];
    }
  }

  private persist(items: CartItem[]): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch {
      // Ignore persistence errors (e.g. private browsing)
    }
  }
}
