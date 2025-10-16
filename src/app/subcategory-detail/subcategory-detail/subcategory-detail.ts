import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, map, switchMap, tap } from 'rxjs';
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
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, RouterModule, FormsModule, BackButtonComponent],
  templateUrl: './subcategory-detail.html',
  styleUrls: ['./subcategory-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcategoryDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly selectedUnits = signal<Record<string, ProductUnitType>>({});
  private readonly selectedColors = signal<Record<string, string | undefined>>({});
  private readonly searchTermSubject = new BehaviorSubject<string>('');

  private readonly baseViewModel$: Observable<SubcategoryDetailViewModel> =
    this.route.paramMap.pipe(
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
  readonly viewModel$: Observable<
    SubcategoryDetailViewModel & {
      filteredProducts: Product[];
      searchTerm: string;
    }
  > = combineLatest([this.baseViewModel$, this.searchTermSubject]).pipe(
    map(([viewModel, searchTerm]) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const filteredProducts = normalizedSearch
        ? viewModel.products.filter((product) => this.matchesSearch(product, normalizedSearch))
        : viewModel.products;

      return { ...viewModel, filteredProducts, searchTerm };
    })
  );
  addToCart(event: Event, product: Product): void {
    event.stopPropagation();
    this.cart.addProduct(
      product,
      this.getSelectedUnitOption(product),
      this.getSelectedColor(product)
    );
  }

  increment(event: Event, product: Product): void {
    event.stopPropagation();
    this.cart.increment(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product)
    );
  }

  decrement(event: Event, product: Product): void {
    event.stopPropagation();
    this.cart.decrement(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product)
    );
  }

  getQuantity(product: Product): number {
    return this.cart.getQuantity(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product)
    );
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
  selectColor(productId: string, color: string): void {
    this.selectedColors.update((colors) => ({ ...colors, [productId]: color }));
  }
  updateSearch(term: string): void {
    this.searchTermSubject.next(term);
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

  getAvailableColors(product: Product): string[] {
    if (product.colors?.length) {
      return product.colors;
    }
    return product.color ? [product.color] : [];
  }

  getSelectedColor(product: Product): string | undefined {
    const current = this.selectedColors()[product.id];
    const colors = this.getAvailableColors(product);
    if (current && colors.includes(current)) {
      return current;
    }
    return colors[0];
  }

  isSelectedColor(product: Product, color: string): boolean {
    return this.getSelectedColor(product) === color;
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

  private matchesSearch(product: Product, searchTerm: string): boolean {
    const haystacks = [
      product.name ?? '',
      product.description ?? '',
      product.color ?? '',
      ...(product.colors ?? []),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    return haystacks.some((value) => value.includes(searchTerm));
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
    this.selectedColors.update((colors) => {
      const next = { ...colors };
      for (const product of products) {
        if (next[product.id]) {
          continue;
        }
        const available = this.getAvailableColors(product);
        if (available.length) {
          next[product.id] = available[0];
        }
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
