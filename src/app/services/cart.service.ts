import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from '@angular/fire/firestore';
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

interface OrderMetadata {
  orderNumber: string;
  orderSequence: number;
  orderMonth: string;
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
      name: item.product.name,
      quantity: item.quantity,
      color: item.product.color,
      price: item.product.price,
    }));

    const createdAt = Timestamp.now();

    const baseOrder: Omit<AdminOrder, 'id' | 'orderNumber' | 'orderSequence' | 'orderMonth'> = {
      customerName: trimmedName,
      customerEmail: details.customerEmail?.trim() || undefined,
      shippingAddress: details.shippingAddress?.trim() || undefined,
      notes: details.notes?.trim() || undefined,
      status: 'pending',
      total: this.total(),
      createdAt,
      items: orderItems,
    };
    if (this.firestore) {
      const metadata = await this.generateOrderMetadata(createdAt);
      const payload: Omit<AdminOrder, 'id'> = { ...baseOrder, ...metadata };
      const orderRef = doc(collection(this.firestore, 'orders'), metadata.orderNumber);
      await setDoc(orderRef, payload);
      const order: AdminOrder = { ...payload, id: metadata.orderNumber };
      console.log({ order: order });
      this.clearCart();
      return order;
    }

    const metadata = this.generateLocalOrderMetadata(createdAt.toDate());
    const fallbackOrder: AdminOrder = { ...baseOrder, ...metadata, id: metadata.orderNumber };

    this.localOrdersSignal.update((orders) => [fallbackOrder, ...orders]);
    this.clearCart();
    return fallbackOrder;
  }

  private async generateOrderMetadata(createdAt: Timestamp): Promise<OrderMetadata> {
    const date = createdAt.toDate();
    const year = date.getFullYear();
    const monthNumber = date.getMonth() + 1;
    const month = monthNumber.toString().padStart(2, '0');
    const orderMonth = `${year}${month}`;
    const ordersRef = collection(this.firestore, 'orders');
    const latestOrderQuery = query(
      ordersRef,
      where('orderMonth', '==', orderMonth),
      orderBy('orderSequence', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(latestOrderQuery);
    const lastSequence = snapshot.empty ? 0 : Number(snapshot.docs[0].data()['orderSequence'] ?? 0);
    const orderSequence = lastSequence + 1;
    const orderNumber = this.composeOrderNumber(year, month, orderSequence);

    return { orderNumber, orderSequence, orderMonth };
  }

  private generateLocalOrderMetadata(createdAt: Date): OrderMetadata {
    const year = createdAt.getFullYear();
    const monthNumber = createdAt.getMonth() + 1;
    const month = monthNumber.toString().padStart(2, '0');
    const orderMonth = `${year}${month}`;
    const lastSequence = this.localOrdersSignal()
      .filter((order) => order.orderMonth === orderMonth)
      .reduce((max, order) => Math.max(max, order.orderSequence ?? 0), 0);
    const orderSequence = lastSequence + 1;
    const orderNumber = this.composeOrderNumber(year, month, orderSequence);

    return { orderNumber, orderSequence, orderMonth };
  }

  private composeOrderNumber(year: number, month: string, sequence: number): string {
    return `${year}-${month}-${sequence.toString().padStart(4, '0')}`;
  }
}
