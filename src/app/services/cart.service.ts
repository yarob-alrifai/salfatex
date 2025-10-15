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
import { Product, ProductUnitOption, ProductUnitType } from '../models/catalog.models';
import { CartItem, CartUnitSelection } from '../models/cart.models';

export interface CheckoutDetails {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  restaurantName?: string;
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
    this.itemsSignal().reduce((total, item) => total + item.quantity * item.unit.price, 0)
  );
  readonly localOrders = computed(() => this.localOrdersSignal());

  addProduct(product: Product, unitOption?: ProductUnitOption) {
    const resolvedUnit = this.createUnitSelection(product, unitOption);
    this.itemsSignal.update((items) => {
      const existingIndex = items.findIndex(
        (item) => item.product.id === product.id && item.unit.type === resolvedUnit.type
      );
      if (existingIndex >= 0) {
        return items.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...items, { product, quantity: 1, unit: resolvedUnit }];
    });
  }

  increment(productId: string, unitType: ProductUnitType) {
    this.itemsSignal.update((items) =>
      items.map((item) =>
        item.product.id === productId && item.unit.type === unitType
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  decrement(productId: string, unitType: ProductUnitType) {
    this.itemsSignal.update((items) =>
      items
        .map((item) =>
          item.product.id === productId && item.unit.type === unitType
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  updateQuantity(productId: string, unitType: ProductUnitType, quantity: number) {
    if (!Number.isFinite(quantity)) {
      return;
    }

    const normalizedQuantity = Math.max(0, Math.floor(quantity));

    this.itemsSignal.update((items) => {
      const index = items.findIndex(
        (item) => item.product.id === productId && item.unit.type === unitType
      );
      if (index === -1) {
        return items;
      }

      if (normalizedQuantity === 0) {
        return items.filter(
          (item) => !(item.product.id === productId && item.unit.type === unitType)
        );
      }

      return items.map((item) =>
        item.product.id === productId && item.unit.type === unitType
          ? { ...item, quantity: normalizedQuantity }
          : item
      );
    });
  }

  removeProduct(productId: string, unitType: ProductUnitType) {
    this.itemsSignal.update((items) =>
      items.filter((item) => !(item.product.id === productId && item.unit.type === unitType))
    );
  }

  clearCart() {
    this.itemsSignal.set([]);
  }

  getQuantity(productId: string, unitType: ProductUnitType): number {
    return (
      this.itemsSignal().find(
        (item) => item.product.id === productId && item.unit.type === unitType
      )?.quantity ?? 0
    );
  }

  async submitOrder(details: CheckoutDetails): Promise<AdminOrder> {
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
      price: item.unit.price,
      unitPrice: item.unit.price,
      unitType: item.unit.type,
      unitLabel: item.unit.label,
      piecesCount: item.unit.piecesCount,
    }));

    const createdAt = Timestamp.now();
    const trimmedRestaurant = details.restaurantName?.trim();
    const trimmedPhone = details.customerPhone?.trim();

    const normalizedNotes = this.composeNotesWithDetails(
      trimmedRestaurant,
      trimmedPhone,
      details.notes
    );

    const baseOrder: Omit<AdminOrder, 'id' | 'orderNumber' | 'orderSequence' | 'orderMonth'> = {
      customerName: trimmedName,
      customerEmail: details.customerEmail?.trim() || undefined,
      customerPhone: trimmedPhone || undefined,
      restaurantName: trimmedRestaurant || undefined,
      shippingAddress: details.shippingAddress?.trim() || undefined,
      notes: normalizedNotes,
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

  private createUnitSelection(product: Product, unitOption?: ProductUnitOption): CartUnitSelection {
    const option = this.resolveUnitOption(product, unitOption);

    return {
      type: option.type,
      price: option.price,
      piecesCount: option.piecesCount,
      label: this.getUnitLabel(option),
    };
  }

  private resolveUnitOption(product: Product, unitOption?: ProductUnitOption): ProductUnitOption {
    if (unitOption) {
      return unitOption;
    }

    if (product.unitOptions?.length) {
      return product.unitOptions[0];
    }

    return {
      type: 'piece',
      price: product.price,
    };
  }

  private getUnitLabel(option: ProductUnitOption): string {
    switch (option.type) {
      case 'bundle':
        return option.piecesCount ? `مجموعة (${option.piecesCount} قطعة)` : 'مجموعة';
      case 'carton':
        return option.piecesCount ? `كرتونة (${option.piecesCount} قطعة)` : 'كرتونة';
      default:
        return 'بالقطعة';
    }
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

  private composeNotesWithDetails(
    restaurantName?: string,
    phone?: string,
    notes?: string | null
  ): string | undefined {
    const parts: string[] = [];
    const trimmedNotes = notes?.toString().trim() ?? '';
    const includesRestaurant = /اسم\s+المطعم/i.test(trimmedNotes);
    const includesPhone = /رقم\s+الهاتف|phone|tel/i.test(trimmedNotes);

    const trimmedRestaurant = restaurantName?.trim();
    const trimmedPhone = phone?.trim();

    if (trimmedRestaurant && !includesRestaurant) {
      parts.push(`اسم المطعم: ${trimmedRestaurant}`);
    }

    if (trimmedPhone && !includesPhone) {
      parts.push(`رقم الهاتف: ${trimmedPhone}`);
    }

    if (trimmedNotes) {
      parts.push(trimmedNotes);
    }

    return parts.length ? parts.join('\n') : undefined;
  }
}
