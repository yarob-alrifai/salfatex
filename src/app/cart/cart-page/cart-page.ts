import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/cart.models';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cart-page.html',
  styleUrls: ['./cart-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPageComponent {
  private readonly cart = inject(CartService);

  readonly items = this.cart.items;
  // readonly totalQuantity = this.cart.totalQuantity;
  readonly totalPrice = this.cart.total;

  trackByProduct(_index: number, item: CartItem): string {
    return item.product.id;
  }

  updateQuantity(productId: string, value: string | number): void {
    const quantity = Number(value);
    if (Number.isNaN(quantity)) {
      return;
    }
    this.cart.updateQuantity(productId, quantity);
  }

  increment(productId: string): void {
    this.cart.increment(productId);
  }

  decrement(productId: string): void {
    this.cart.decrement(productId);
  }

  remove(productId: string): void {
    this.cart.removeProduct(productId);
  }

  clear(): void {
    this.cart.clearCart();
  }

  lineTotal(item: CartItem): number {
    return item.product.price * item.quantity;
  }
}
