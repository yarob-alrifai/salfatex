import { Injectable, computed, inject, signal } from '@angular/core';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { Timestamp } from 'firebase/firestore';
import type { AdminOrder, OrderItem } from '../admin/admin-data.service';
import { Product } from '../models/catalog.models';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutDetails {
  customerName: string;
  customerEmail?: string;
  shippingAddress?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly firestore = inject(Firestore);

  private readonly itemsSignal = signal<CartItem[]>([]);
  private readonly localOrdersSignal = signal<AdminOrder[]>([]);

  readonly items = computed(() => this.itemsSignal());
  readonly itemCount = computed(() =>
    this.itemsSignal().reduce((total, item) => total + item.quantity, 0)
  );
  readonly total = computed(() =>
    this.itemsSignal().reduce((total, item) => total + item.quantity * item.product.price, 0)
  );
  readonly localOrders = computed(() => this.localOrdersSignal());

  addProduct(product: Product) {
    this.itemsSignal.update((items) => {
      const existingIndex = items.findIndex((item) => item.product.id === product.id);

      if (existingIndex >= 0) {
        return items.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...items, { product, quantity: 1 }];
    });
  }

  increment(productId: string) {
    this.itemsSignal.update((items) =>
      items.map((item) =>
        item.product.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  decrement(productId: string) {
    this.itemsSignal.update((items) =>
      items
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  removeProduct(productId: string) {
    this.itemsSignal.update((items) => items.filter((item) => item.product.id !== productId));
  }

  clearCart() {
    this.itemsSignal.set([]);
  }

  getQuantity(productId: string): number {
    return this.itemsSignal().find((item) => item.product.id === productId)?.quantity ?? 0;
  }

  async submitOrder(details: CheckoutDetails): Promise<AdminOrder> {
    console.log('yarob');
    const trimmedName = details.customerName?.trim();

    if (!trimmedName) {
      throw new Error('يجب إدخال اسم العميل قبل تأكيد الطلب.');
    }

    const items = this.itemsSignal();

    if (!items.length) {
      throw new Error('لا توجد عناصر في السلة.');
    }

    const orderItems: OrderItem[] = items.map((item) => ({
      productId: item.product.id,
      name: item.product.name.ar,
      quantity: item.quantity,
      color: item.product.color,
      price: item.product.price,
    }));

    const payload: Omit<AdminOrder, 'id'> = {
      customerName: trimmedName,
      // customerEmail: details.customerEmail?.trim() || undefined,
      // shippingAddress: details.shippingAddress?.trim() || undefined,
      // notes: details.notes?.trim() || undefined,
      status: 'pending',
      total: this.total(),
      createdAt: Timestamp.now(),
      items: orderItems,
    };
    await addDoc(collection(this.firestore, 'orders'), payload);
    if (this.firestore) {
      const ref = await addDoc(collection(this.firestore, 'orders'), payload);
      const order: AdminOrder = { ...payload, id: ref.id };

      console.log({ order: order });
      this.clearCart();
      return order;
    }

    const fallbackOrder: AdminOrder = { ...payload, id: this.createLocalId() };
    this.localOrdersSignal.update((orders) => [fallbackOrder, ...orders]);
    this.clearCart();
    return fallbackOrder;
  }

  private createLocalId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2, 10);
  }
}
