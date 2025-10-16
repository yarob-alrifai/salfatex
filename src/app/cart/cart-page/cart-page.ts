import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/cart.models';
import { BackButtonComponent } from 'src/app/component/back-button/back-button';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackButtonComponent],
  templateUrl: './cart-page.html',
  styleUrls: ['./cart-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPageComponent {
  private readonly cart = inject(CartService);
  private readonly location = inject(Location);

  readonly items = this.cart.items;
  // readonly totalQuantity = this.cart.totalQuantity;
  readonly totalPrice = this.cart.total;

  trackByProduct(_index: number, item: CartItem): string {
    return `${item.product.id}-${item.unit.type}-${item.color ?? 'default'}`;
  }

  updateQuantity(item: CartItem, value: string | number): void {
    const quantity = Number(value);
    if (Number.isNaN(quantity)) {
      return;
    }
    this.cart.updateQuantity(item.product.id, item.unit.type, quantity, item.color);
  }

  increment(item: CartItem): void {
    this.cart.increment(item.product.id, item.unit.type, item.color);
  }

  decrement(item: CartItem): void {
    this.cart.decrement(item.product.id, item.unit.type, item.color);
  }

  remove(item: CartItem): void {
    this.cart.removeProduct(item.product.id, item.unit.type, item.color);
  }

  clear(): void {
    this.cart.clearCart();
  }

  lineTotal(item: CartItem): number {
    return item.unit.price * item.quantity;
  }
}
