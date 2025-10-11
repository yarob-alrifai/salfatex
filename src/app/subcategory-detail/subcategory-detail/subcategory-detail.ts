import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, combineLatest, map, switchMap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import { Category, Product, Subcategory } from '../../models/catalog.models';
import { BackButtonComponent } from 'src/app/component/back-button/back-button';

interface SubcategoryDetailViewModel {
  category?: Category;
  subcategory?: Subcategory;
  products: Product[];
  categoryId: string;
  subcategoryId: string;
}

@Component({
  selector: 'app-subcategory-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, BackButtonComponent],
  templateUrl: './subcategory-detail.html',
  styleUrls: ['./subcategory-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcategoryDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);

  readonly viewModel$: Observable<SubcategoryDetailViewModel> = this.route.paramMap.pipe(
    map((params) => ({
      categoryId: params.get('categoryId') ?? '',
      subcategoryId: params.get('subcategoryId') ?? '',
    })),
    switchMap(({ categoryId, subcategoryId }) =>
      combineLatest([
        this.catalog.getCategoryById(categoryId),
        this.catalog.getSubcategoryById(subcategoryId),
        this.catalog.getProductsForSubcategory(categoryId, subcategoryId),
      ]).pipe(
        map(([category, subcategory, products]) => ({
          category,
          subcategory,
          products,
          categoryId,
          subcategoryId,
        }))
      )
    )
  );

  addToCart(event: Event, product: Product): void {
    event.stopPropagation();
    this.cart.addProduct(product);
  }

  increment(event: Event, product: Product): void {
    event.stopPropagation();
    this.cart.increment(product.id);
  }

  decrement(event: Event, product: Product): void {
    event.stopPropagation();
    this.cart.decrement(product.id);
  }

  getQuantity(productId: string): number {
    return this.cart.getQuantity(productId);
  }

  trackByProductId(_: number, product: Product): string {
    return product.id;
  }
}
