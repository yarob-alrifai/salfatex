import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, combineLatest, map, switchMap, tap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import {
  Category,
  Product,
  ProductUnitOption,
  ProductUnitType,
  Subcategory,
} from '../../models/catalog.models';
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
  private readonly selectedUnits = signal<Record<string, ProductUnitType>>({});

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
        tap(([, , products]) => this.ensureDefaults(products)),

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
    this.cart.addProduct(product, this.getSelectedUnitOption(product));
  }

  increment(event: Event, product: Product): void {
    event.stopPropagation();
    this.cart.increment(product.id, this.getSelectedUnitType(product));
  }

  decrement(event: Event, product: Product): void {
    event.stopPropagation();
    this.cart.decrement(product.id, this.getSelectedUnitType(product));
  }

  getQuantity(product: Product): number {
    return this.cart.getQuantity(product.id, this.getSelectedUnitType(product));
  }

  trackByProductId(_: number, product: Product): string {
    return product.id;
  }

  trackUnitType(_: number, option: ProductUnitOption): ProductUnitType {
    return option.type;
  }

  selectUnit(productId: string, unitType: ProductUnitType): void {
    this.selectedUnits.update((units) => ({ ...units, [productId]: unitType }));
  }

  getAvailableUnitOptions(product: Product): ProductUnitOption[] {
    if (product.unitOptions?.length) {
      return product.unitOptions;
    }

    return [
      {
        type: 'piece',
        price: product.price,
      },
    ];
  }

  getSelectedUnitOption(product: Product): ProductUnitOption {
    const selectedType = this.getSelectedUnitType(product);
    const options = this.getAvailableUnitOptions(product);
    return (
      options.find((option) => option.type === selectedType) ?? {
        type: 'piece',
        price: product.price,
      }
    );
  }

  getSelectedUnitPrice(product: Product): number {
    return this.getSelectedUnitOption(product).price;
  }

  getUnitLabel(option: ProductUnitOption): string {
    switch (option.type) {
      case 'bundle':
        return option.piecesCount ? `مجموعة (${option.piecesCount} قطعة)` : 'مجموعة';
      case 'carton':
        return option.piecesCount ? `كرتونة (${option.piecesCount} قطعة)` : 'كرتونة';
      default:
        return 'بالقطعة';
    }
  }

  isSelectedUnit(product: Product, option: ProductUnitOption): boolean {
    return this.getSelectedUnitType(product) === option.type;
  }

  private ensureDefaults(products: Product[]): void {
    this.selectedUnits.update((units) => {
      const next = { ...units };
      for (const product of products) {
        if (next[product.id]) {
          continue;
        }

        const defaultType = product.unitOptions?.[0]?.type;

        next[product.id] = defaultType ?? 'piece';
      }
      return next;
    });
  }

  private getSelectedUnitType(product: Product): ProductUnitType {
    const current = this.selectedUnits()[product.id];
    if (current) {
      return current;
    }

    const defaultType = product.unitOptions?.[0]?.type;
    return defaultType ?? 'piece';
  }
}
