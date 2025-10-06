import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, combineLatest, map, of, switchMap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { Category, Product, Subcategory } from '../../models/catalog.models';
import { CartService } from '../../services/cart.service';

interface SubcategoryViewModel {
  subcategory: Subcategory;
  products: Product[];
}

@Component({
  selector: 'app-subcategory-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './subcategory-list.html',
  styleUrls: ['./subcategory-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcategoryListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);

  readonly viewModel$: Observable<{ category?: Category; items: SubcategoryViewModel[] }> =
    this.route.paramMap.pipe(
      map((params) => params.get('categoryId') ?? ''),
      switchMap((categoryId) =>
        combineLatest([
          this.catalog.getCategoryById(categoryId),
          this.catalog.getSubcategories(categoryId).pipe(
            switchMap((subcategories) => {
              if (!subcategories.length) {
                return of<SubcategoryViewModel[]>([]);
              }

              return combineLatest(
                subcategories.map((subcategory) =>
                  this.catalog
                    .getProductsForSubcategory(categoryId, subcategory.id)
                    .pipe(map((products) => ({ subcategory, products })))
                )
              );
            })
          ),
        ]).pipe(map(([category, items]) => ({ category, items })))
      )
    );

  addToCart(product: Product): void {
    this.cart.addProduct(product);
  }
}
