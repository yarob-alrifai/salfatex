import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-floating-cart-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-cart-button.html',
  styleUrls: ['./floating-cart-button.scss'],
})
export class FloatingCartButtonComponent {
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);

  readonly itemCount = this.cartService.itemCount;
  readonly hasItems = computed(() => this.itemCount() > 0);

  navigateToCart() {
    if (this.hasItems()) {
      this.router.navigate(['/cart']);
    }
  }
}
