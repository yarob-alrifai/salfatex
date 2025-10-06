import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, map, switchMap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { Product } from '../../models/catalog.models';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-detail.html',
  styleUrls: ['./product-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);

  readonly quantity = signal(1);
  readonly product$: Observable<Product | undefined> = this.route.paramMap.pipe(
    map((params) => params.get('productId') ?? ''),
    switchMap((productId) => this.catalog.getProductById(productId))
  );

  increase(): void {
    this.quantity.update((current) => current + 1);
  }

  decrease(): void {
    this.quantity.update((current) => Math.max(1, current - 1));
  }

  updateQuantityFromInput(value: string | number): void {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    this.quantity.set(Math.max(1, Math.floor(parsed)));
  }

  addToCart(product: Product): void {
    this.cart.addItem(product, this.quantity());
  }
}
