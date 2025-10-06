import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart-widget',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart-widget.html',
  styleUrls: ['./cart-widget.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartWidgetComponent {
  private readonly cart = inject(CartService);

  readonly totalQuantity = this.cart.totalQuantity;
  readonly totalPrice = this.cart.totalPrice;
  readonly hasItems = computed(() => this.totalQuantity() > 0);
}
