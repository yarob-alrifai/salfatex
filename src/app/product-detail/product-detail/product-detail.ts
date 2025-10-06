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

  addToCart(product: Product) {
    this.cart.addProduct(product);
  }

  increment(product: Product) {
    this.cart.increment(product.id);
  }

  decrement(product: Product) {
    this.cart.decrement(product.id);
  }

  getQuantity(productId: string): number {
    return this.cart.getQuantity(productId);
  }
}
