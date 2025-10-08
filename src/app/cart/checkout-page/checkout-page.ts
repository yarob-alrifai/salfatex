import { ChangeDetectionStrategy, Component, Signal, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartItem, CartSnapshot, CustomerInfo } from '../../models/cart.models';

interface CheckoutConfirmation {
  info: CustomerInfo;
  snapshot: CartSnapshot;
  createdAt: Date;
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
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly items: Signal<CartItem[]> = this.cart.items;
  readonly totalPrice = this.cart.total;

  readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    restaurantName: ['', Validators.required],
    address: ['', Validators.required],
    notes: [''],
  });

  readonly confirmation = signal<CheckoutConfirmation | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const info: CustomerInfo = {
      name: rawValue.name?.trim() ?? '',
      email: rawValue.email?.trim() ?? '',
      restaurantName: rawValue.restaurantName?.trim() ?? '',
      address: rawValue.address?.trim() ?? '',
      notes: rawValue.notes?.trim() || undefined,
    }; // const snapshot = this.cart.createSnapshot();

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
      const notes = this.composeNotes(info.restaurantName, info.notes);
      const order = await this.cart.submitOrder({
        customerName: info.name,
        customerEmail: info.email || undefined,
        shippingAddress: info.address,
        notes,
      });

      this.confirmation.set({
        info,
        snapshot,
        createdAt: order.createdAt.toDate(),
      });
      this.form.reset();
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

  private composeNotes(restaurantName: string, notes?: string): string | undefined {
    const details: string[] = [];

    const trimmedRestaurant = restaurantName?.trim();
    const trimmedNotes = notes?.trim();

    if (trimmedRestaurant) {
      details.push(`اسم المطعم: ${trimmedRestaurant}`);
    }

    if (trimmedNotes) {
      details.push(trimmedNotes);
    }

    if (!details.length) {
      return undefined;
    }

    return details.join('\n');
  }
}
