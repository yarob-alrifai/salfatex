import { Injectable, computed, inject, signal } from '@angular/core';
import { Firestore, collection, doc, runTransaction, setDoc } from '@angular/fire/firestore';

import { Timestamp } from 'firebase/firestore';
import type { AdminOrder, OrderItem } from '../admin/admin-data.service';
import { Product, ProductUnitOption, ProductUnitType } from '../models/catalog.models';
import { CartItem, CartUnitSelection } from '../models/cart.models';
import { getProductFabrics } from '../models/product-helpers';

export interface CheckoutDetails {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  restaurantName?: string;
  shippingAddress?: string;
  notes?: string;
  recaptchaToken?: string;
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

  addProduct(
    product: Product,
    unitOption?: ProductUnitOption,
    selectedColor?: string,

    quantity: number = 1,
    selectedFabric?: string
  ) {
    const resolvedUnit = this.createUnitSelection(product, unitOption);
    const normalizedColor = selectedColor?.trim() || product.color?.trim();

    const normalizedFabric = (
      selectedFabric?.trim() || getProductFabrics(product)[0]?.name
    )?.trim();

    const productWithColor = normalizedColor ? { ...product, color: normalizedColor } : product;
    const quantityToAdd = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;

    if (quantityToAdd <= 0) {
      return;
    }

    this.itemsSignal.update((items) => {
      const existingIndex = items.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.unit.type === resolvedUnit.type &&
          (item.color ?? item.product.color ?? null) === (normalizedColor ?? null) &&
          (item.fabric ?? null) === (normalizedFabric ?? null)
      );
      if (existingIndex >= 0) {
        return items.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + quantityToAdd } : item
        );
      }

      return [
        ...items,
        {
          product: productWithColor,
          quantity: quantityToAdd,
          unit: resolvedUnit,
          color: normalizedColor ?? undefined,
          fabric: normalizedFabric,
        },
      ];
    });
  }

  increment(
    productId: string,
    unitType: ProductUnitType,
    color?: string,
    step: number = 1,
    fabric?: string
  ) {
    if (!Number.isFinite(step) || step <= 0) {
      return;
    }

    const normalizedStep = Math.max(1, Math.floor(step));
    this.itemsSignal.update((items) =>
      items.map((item) =>
        item.product.id === productId &&
        item.unit.type === unitType &&
        (item.color ?? item.product.color ?? null) === (color ?? null) &&
        (item.fabric ?? null) === (fabric ?? null)
          ? { ...item, quantity: item.quantity + normalizedStep }
          : item
      )
    );
  }

  decrement(
    productId: string,
    unitType: ProductUnitType,
    color?: string,
    step: number = 1,
    fabric?: string
  ) {
    if (!Number.isFinite(step) || step <= 0) {
      return;
    }

    const normalizedStep = Math.max(1, Math.floor(step));
    this.itemsSignal.update((items) =>
      items
        .map((item) =>
          item.product.id === productId &&
          item.unit.type === unitType &&
          (item.color ?? item.product.color ?? null) === (color ?? null) &&
          (item.fabric ?? null) === (fabric ?? null)
            ? { ...item, quantity: item.quantity - normalizedStep }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  updateQuantity(
    productId: string,
    unitType: ProductUnitType,
    quantity: number,
    color?: string,
    fabric?: string
  ) {
    if (!Number.isFinite(quantity)) {
      return;
    }

    const normalizedQuantity = Math.max(0, Math.floor(quantity));

    this.itemsSignal.update((items) => {
      const index = items.findIndex(
        (item) =>
          item.product.id === productId &&
          item.unit.type === unitType &&
          (item.color ?? item.product.color ?? null) === (color ?? null) &&
          (item.fabric ?? null) === (fabric ?? null)
      );
      if (index === -1) {
        return items;
      }

      if (normalizedQuantity === 0) {
        return items.filter(
          (item) =>
            !(
              item.product.id === productId &&
              item.unit.type === unitType &&
              (item.color ?? item.product.color ?? null) === (color ?? null) &&
              (item.fabric ?? null) === (fabric ?? null)
            )
        );
      }

      return items.map((item) =>
        item.product.id === productId &&
        item.unit.type === unitType &&
        (item.color ?? item.product.color ?? null) === (color ?? null) &&
        (item.fabric ?? null) === (fabric ?? null)
          ? { ...item, quantity: normalizedQuantity }
          : item
      );
    });
  }

  removeProduct(productId: string, unitType: ProductUnitType, color?: string, fabric?: string) {
    this.itemsSignal.update((items) =>
      items.filter(
        (item) =>
          !(
            item.product.id === productId &&
            item.unit.type === unitType &&
            (item.color ?? item.product.color ?? null) === (color ?? null) &&
            (item.fabric ?? null) === (fabric ?? null)
          )
      )
    );
  }

  clearCart() {
    this.itemsSignal.set([]);
  }

  getQuantity(
    productId: string,
    unitType: ProductUnitType,
    color?: string,
    fabric?: string
  ): number {
    return (
      this.itemsSignal().find(
        (item) =>
          item.product.id === productId &&
          item.unit.type === unitType &&
          (item.color ?? item.product.color ?? null) === (color ?? null) &&
          (item.fabric ?? null) === (fabric ?? null)
      )?.quantity ?? 0
    );
  }

  async submitOrder(details: CheckoutDetails): Promise<AdminOrder> {
    const trimmedName = details.customerName?.trim();

    if (!trimmedName) {
      throw new Error('Укажите имя клиента перед подтверждением заказа.');
    }

    const recaptchaToken = details.recaptchaToken?.trim();

    if (!recaptchaToken) {
      throw new Error('Подтвердите проверку reCAPTCHA перед отправкой заказа.');
    }

    const items = this.itemsSignal();

    if (!items.length) {
      throw new Error('Корзина пуста. Добавьте товары, прежде чем отправлять заказ.');
    }

    const orderItems: OrderItem[] = items.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      color: item.color ?? item.product.color,
      fabric: item.fabric,

      price: item.unit.price,
      unitPrice: item.unit.price,
      unitType: item.unit.type,
      unitLabel: item.unit.label,
      piecesCount: item.unit.piecesCount,
    }));

    const createdAt = Timestamp.now();
    const trimmedRestaurant = details.restaurantName?.trim();
    const trimmedPhone = details.customerPhone?.trim();

    const normalizedNotes = this.composeNotesWithDetails(details.notes);

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
    const sanitizedBaseOrder = this.stripUndefined(baseOrder);

    if (this.firestore) {
      const metadata = await this.generateOrderMetadata(createdAt);
      const payload = this.stripUndefined<Omit<AdminOrder, 'id'>>({
        ...sanitizedBaseOrder,
        ...metadata,
      });
      const orderRef = doc(collection(this.firestore, 'orders'), metadata.orderNumber);
      await setDoc(orderRef, payload);
      const order: AdminOrder = { ...payload, id: metadata.orderNumber };
      this.clearCart();
      return order;
    }

    const metadata = this.generateLocalOrderMetadata(createdAt.toDate());
    const fallbackOrder: AdminOrder = {
      ...sanitizedBaseOrder,
      ...metadata,
      id: metadata.orderNumber,
    };
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

    const fabrics = getProductFabrics(product);
    const [firstFabric] = fabrics;

    if (product.unitOptions?.length) {
      return product.unitOptions[0];
    }

    if (firstFabric?.unitOptions?.length) {
      return firstFabric.unitOptions[0];
    }

    return {
      type: 'piece',
      price: product.price,
    };
  }

  private getUnitLabel(option: ProductUnitOption): string {
    switch (option.type) {
      case 'bundle':
        return option.piecesCount ? `Комплект (${option.piecesCount} шт.)` : 'Комплект';
      case 'carton':
        return option.piecesCount ? `Коробка (${option.piecesCount} шт.)` : 'Коробка';
      default:
        return 'Поштучно';
    }
  }

  private async generateOrderMetadata(createdAt: Timestamp): Promise<OrderMetadata> {
    const date = createdAt.toDate();
    const year = date.getFullYear();
    const monthNumber = date.getMonth() + 1;
    const month = monthNumber.toString().padStart(2, '0');
    const orderMonth = `${year}${month}`;
    const counterRef = doc(this.firestore, 'orderCounters', orderMonth);
    const orderSequence = await runTransaction(this.firestore, async (transaction) => {
      const snapshot = await transaction.get(counterRef);
      const lastSequence = snapshot.exists() ? Number(snapshot.data()?.['sequence'] ?? 0) : 0;
      const nextSequence = lastSequence + 1;

      transaction.set(
        counterRef,
        {
          sequence: nextSequence,
          updatedAt: createdAt,
        },
        { merge: true }
      );

      return nextSequence;
    });
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

  private stripUndefined<T>(input: T): T {
    if (input instanceof Timestamp) {
      return input;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.stripUndefined(item)) as unknown as T;
    }

    if (input && typeof input === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (value === undefined) {
          continue;
        }

        sanitized[key] = this.stripUndefined(value);
      }

      return sanitized as T;
    }

    return input;
  }

  private composeNotesWithDetails(notes?: string | null): string | undefined {
    const parts: string[] = [];
    const trimmedNotes = notes?.toString().trim() ?? '';

    if (trimmedNotes) {
      parts.push(trimmedNotes);
    }

    return parts.length ? parts.join('\n') : undefined;
  }
}
