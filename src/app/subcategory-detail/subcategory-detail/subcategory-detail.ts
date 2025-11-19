import { CommonModule, NgOptimizedImage } from '@angular/common';
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
  ProductFabric,
} from '../../models/catalog.models';
import { getProductAllColors, getProductFabrics } from '../../models/product-helpers';

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
  imports: [CommonModule, RouterModule, FormsModule, BackButtonComponent, NgOptimizedImage],
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
  private readonly selectedFabrics = signal<Record<string, number>>({});

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

      this.getSelectedColor(product),
      1,
      this.getSelectedFabric(product)?.name
    );
  }

  increment(event: Event, product: Product, step: number = 1): void {
    event.stopPropagation();
    this.cart.increment(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product),
      step,
      this.getSelectedFabric(product)?.name
    );
  }

  decrement(event: Event, product: Product, step: number = 1): void {
    event.stopPropagation();
    this.cart.decrement(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product),
      step,
      this.getSelectedFabric(product)?.name
    );
  }

  getQuantity(product: Product): number {
    return this.cart.getQuantity(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product),
      this.getSelectedFabric(product)?.name
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
    const fabric = this.getSelectedFabric(product);
    if (fabric?.unitOptions?.length) {
      return fabric.unitOptions;
    }

    const fallbackFabric = this.getAvailableFabrics(product)[0];
    if (fallbackFabric?.unitOptions?.length) {
      return fallbackFabric.unitOptions;
    }

    if (product.unitOptions?.length) {
      return product.unitOptions;
    }

    return [
      {
        type: 'piece',
        price: product.price ?? 0,
      },
    ];
  }

  getSelectedUnitOption(product: Product): ProductUnitOption {
    const selectedType = this.getSelectedUnitType(product);
    const options = this.getAvailableUnitOptions(product);

    const fallbackOption =
      options[0] ?? ({ type: 'piece', price: product.price ?? 0 } as ProductUnitOption);

    return options.find((option) => option.type === selectedType) ?? fallbackOption;
  }

  getSelectedUnitPrice(product: Product): number {
    const option = this.getSelectedUnitOption(product);
    return option.price ?? product.price ?? 0;
  }

  getAvailableColors(product: Product): string[] {
    const fabric = this.getSelectedFabric(product);
    if (fabric?.colors?.length) {
      return fabric.colors;
    }

    const fallbackFabric = this.getAvailableFabrics(product)[0];
    if (fallbackFabric?.colors?.length) {
      return fallbackFabric.colors;
    }

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

  getAvailableFabrics(product: Product): ProductFabric[] {
    return getProductFabrics(product);
  }

  selectFabric(product: Product, index: number): void {
    this.selectedFabrics.update((fabrics) => ({ ...fabrics, [product.id]: index }));
    const defaultUnit = this.getAvailableUnitOptions(product)[0]?.type ?? 'piece';
    this.selectedUnits.update((units) => ({ ...units, [product.id]: defaultUnit }));
    const colors = this.getAvailableColors(product);
    if (colors.length) {
      this.selectedColors.update((map) => ({ ...map, [product.id]: colors[0] }));
    } else {
      this.selectedColors.update((map) => {
        const next = { ...map };
        delete next[product.id];
        return next;
      });
    }
  }

  isSelectedFabric(product: Product, index: number): boolean {
    const current = this.selectedFabrics()[product.id];
    return (current ?? 0) === index;
  }

  getUnitLabel(option: ProductUnitOption): string {
    switch (option.type) {
      case 'bundle':
        return option.piecesCount ? `Комплект (${option.piecesCount} шт.)` : 'Комплект';
      case 'carton':
        return option.piecesCount ? `Коробка (${option.piecesCount} шт.)` : 'Коробка';
      default:
        return 'Поштучно';
    }
  }

  isSelectedUnit(product: Product, option: ProductUnitOption): boolean {
    return this.getSelectedUnitType(product) === option.type;
  }

  private matchesSearch(product: Product, searchTerm: string): boolean {
    const fabrics = getProductFabrics(product);
    const fabricNames = fabrics
      .map((fabric) => fabric.name ?? '')
      .filter((value): value is string => Boolean(value));
    const colorValues = getProductAllColors(product);
    const haystacks = [
      product.name ?? '',
      product.description ?? '',
      ...fabricNames,
      ...colorValues,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    return haystacks.some((value) => value.includes(searchTerm));
  }

  private ensureDefaults(products: Product[]): void {
    this.selectedFabrics.update((fabrics) => {
      const next = { ...fabrics };
      for (const product of products) {
        const availableFabrics = this.getAvailableFabrics(product);
        const currentIndex = next[product.id];
        if (currentIndex !== undefined && availableFabrics[currentIndex]) {
          continue;
        }
        if (availableFabrics.length) {
          next[product.id] = 0;
        } else {
          delete next[product.id];
        }
      }
      return next;
    });

    this.selectedUnits.update((units) => {
      const next = { ...units };
      for (const product of products) {
        const options = this.getAvailableUnitOptions(product);
        const current = next[product.id];
        if (current && options.some((option) => option.type === current)) {
          continue;
        }

        if (options.length) {
          next[product.id] = options[0].type;
        } else {
          delete next[product.id];
        }
      }
      return next;
    });
    this.selectedColors.update((colors) => {
      const next = { ...colors };
      for (const product of products) {
        const available = this.getAvailableColors(product);
        const current = next[product.id];
        if (current && available.includes(current)) {
          continue;
        }

        if (available.length) {
          next[product.id] = available[0];
        } else {
          delete next[product.id];
        }
      }
      return next;
    });
  }

  private getSelectedUnitType(product: Product): ProductUnitType {
    const current = this.selectedUnits()[product.id];
    const options = this.getAvailableUnitOptions(product);
    if (current && options.some((option) => option.type === current)) {
      return current;
    }

    const defaultType = options[0]?.type ?? 'piece';
    this.selectedUnits.update((units) => ({ ...units, [product.id]: defaultType }));
    return defaultType;
  }

  private getSelectedFabric(product: Product): ProductFabric | null {
    const fabrics = this.getAvailableFabrics(product);
    const index = this.selectedFabrics()[product.id];
    if (index !== undefined && fabrics[index]) {
      return fabrics[index];
    }
    return fabrics[0] ?? null;
  }
}
