import { ChangeDetectionStrategy, Component, Signal, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartItem, CartSnapshot, CustomerInfo } from '../../models/cart.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CheckoutConfirmation {
  info: CustomerInfo;
  snapshot: CartSnapshot;
  createdAt: Date;

  orderNumber: string | null;
}

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './checkout-page.html',
  styleUrls: ['./checkout-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent {
  private readonly cart = inject(CartService);
  private readonly fb = inject(FormBuilder);
  private readonly location = inject(Location);

  private readonly storage: Storage | null =
    typeof window === 'undefined' ? null : window.localStorage;
  private readonly customerInfoStorageKey = 'checkout.customer-info';
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly items: Signal<CartItem[]> = this.cart.items;
  readonly totalPrice = this.cart.total;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    restaurantName: ['', Validators.required],
    address: ['', Validators.required],
    phone: ['', [Validators.required, Validators.minLength(8)]],

    notes: [''],
  });

  readonly confirmation = signal<CheckoutConfirmation | null>(null);
  constructor() {
    this.restoreCustomerInfo();

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.saveCustomerInfo(value);
    });
  }

  goBack(): void {
    this.location.back();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const info = this.normalizeCustomerInfo(rawValue);

    const itemsSnapshot = this.items().map((item) => ({ ...item }));
    const snapshot: CartSnapshot = {
      items: itemsSnapshot,
      total: this.totalPrice(),
    };

    if (!snapshot.items.length) {
      this.errorMessage.set('السلة فارغة. الرجاء إضافة منتجات قبل إتمام الطلب.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      const notes = this.composeNotes(info.restaurantName, info.phone, info.notes);
      const order = await this.cart.submitOrder({
        customerName: info.name,
        customerEmail: info.email || undefined,
        customerPhone: info.phone || undefined,
        restaurantName: info.restaurantName || undefined,
        shippingAddress: info.address,
        notes,
      });

      this.confirmation.set({
        info,
        snapshot,
        createdAt: order.createdAt.toDate(),
        orderNumber: order.orderNumber ?? order.id ?? null,
      });
      const persisted = this.saveCustomerInfo(info) ?? info;
      this.form.reset(
        {
          ...persisted,
          notes: persisted.notes ?? '',
        },
        { emitEvent: false }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر إرسال الطلب. حاول مرة أخرى لاحقاً.';
      this.errorMessage.set(message);
    } finally {
      this.submitting.set(false);
    }
  }

  trackByProduct(_index: number, item: CartItem): string {
    return item.product.id;
  }

  private composeNotes(restaurantName: string, phone?: string, notes?: string): string | undefined {
    const details: string[] = [];

    const trimmedRestaurant = restaurantName?.trim();
    const trimmedPhone = phone?.trim();

    const trimmedNotes = notes?.trim();

    if (trimmedRestaurant) {
      details.push(`اسم المطعم: ${trimmedRestaurant}`);
    }

    if (trimmedPhone) {
      details.push(`رقم الهاتف: ${trimmedPhone}`);
    }

    if (trimmedNotes) {
      details.push(trimmedNotes);
    }

    if (!details.length) {
      return undefined;
    }

    return details.join('\n');
  }

  private restoreCustomerInfo(): void {
    const saved = this.loadCustomerInfo();

    if (!saved) {
      return;
    }

    this.form.patchValue(
      {
        ...saved,
        notes: saved.notes ?? '',
      },
      { emitEvent: false }
    );
  }

  private loadCustomerInfo(): CustomerInfo | null {
    if (!this.storage) {
      return null;
    }

    const raw = this.storage.getItem(this.customerInfoStorageKey);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<CustomerInfo>;
      return this.normalizeCustomerInfo(parsed);
    } catch {
      this.storage.removeItem(this.customerInfoStorageKey);
      return null;
    }
  }

  private saveCustomerInfo(
    value: Partial<CustomerInfo> & { notes?: string | null }
  ): CustomerInfo | null {
    if (!this.storage) {
      return null;
    }

    const normalized = this.normalizeCustomerInfo(value);
    const hasMeaningfulData = Boolean(
      normalized.name ||
        normalized.email ||
        normalized.restaurantName ||
        normalized.phone ||
        normalized.address ||
        normalized.notes
    );

    if (!hasMeaningfulData) {
      this.storage.removeItem(this.customerInfoStorageKey);
      return null;
    }

    this.storage.setItem(this.customerInfoStorageKey, JSON.stringify(normalized));
    return normalized;
  }

  private normalizeCustomerInfo(
    value: Partial<CustomerInfo> & { notes?: string | null }
  ): CustomerInfo {
    const name = value.name?.toString().trim() ?? '';
    const email = value.email?.toString().trim() ?? '';
    const restaurantName = value.restaurantName?.toString().trim() ?? '';
    const phone = value.phone?.toString().trim() ?? '';

    const address = value.address?.toString().trim() ?? '';
    const notes = value.notes?.toString().trim() || undefined;

    return {
      name,
      email,
      restaurantName,
      phone,

      address,
      notes,
    };
  }
}
