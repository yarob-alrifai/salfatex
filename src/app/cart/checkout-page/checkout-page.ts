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

  readonly items: Signal<CartItem[]> = this.cart.items;
  readonly totalPrice = this.cart.totalPrice;

  readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    restaurantName: ['', Validators.required],
    address: ['', Validators.required],
    notes: [''],
  });

  readonly confirmation = signal<CheckoutConfirmation | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const info = this.form.getRawValue() as CustomerInfo;
    const snapshot = this.cart.createSnapshot();

    if (!snapshot.items.length) {
      return;
    }

    this.cart.clear();
    this.form.reset();
    this.confirmation.set({ info, snapshot, createdAt: new Date() });
  }

  trackByProduct(_index: number, item: CartItem): string {
    return item.product.id;
  }
}
