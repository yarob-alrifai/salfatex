import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, map, switchMap, tap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';

import { CartService } from '../../services/cart.service';
import { BackButtonComponent } from 'src/app/component/back-button/back-button';
import {
  Product,
  ProductFabric,
  ProductUnitOption,
  ProductUnitType,
} from '../../models/catalog.models';
import { getProductFabrics } from '../../models/product-helpers';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, BackButtonComponent],
  templateUrl: './product-detail.html',
  styleUrls: ['./product-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly selectedFabricIndex = signal<number | null>(null);

  readonly quantity = signal(1);
  private readonly selectedUnitType = signal<ProductUnitType | null>(null);
  private readonly selectedColor = signal<string | null>(null);

  readonly product$: Observable<Product | undefined> = this.route.paramMap.pipe(
    map((params) => params.get('productId') ?? ''),
    switchMap((productId) => this.catalog.getProductById(productId)),
    tap((product) => {
      this.ensureDefaultFabric(product);

      this.ensureDefaultUnit(product);
      this.ensureDefaultColor(product);
    })
  );

  addToCart(product: Product, quantity: number = 1) {
    this.cart.addProduct(
      product,
      this.getSelectedUnitOption(product),

      this.getSelectedColor(product) ?? undefined,
      quantity,
      this.getSelectedFabric(product)?.name
    );
  }

  increment(product: Product, step: number = 1) {
    this.cart.increment(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product) ?? undefined,
      step,
      this.getSelectedFabric(product)?.name
    );
  }

  decrement(product: Product, step: number = 1) {
    this.cart.decrement(
      product.id,
      this.getSelectedUnitType(product),

      this.getSelectedColor(product) ?? undefined,
      step,
      this.getSelectedFabric(product)?.name
    );
  }

  getQuantity(product: Product): number {
    return this.cart.getQuantity(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product) ?? undefined,
      this.getSelectedFabric(product)?.name
    );
  }

  getMainImage(product: Product): string | undefined {
    return product.mainImageUrl ?? product.galleryUrls?.[0];
  }

  getGalleryImages(product: Product): string[] {
    const gallery = product.galleryUrls ?? [];
    if (!product.mainImageUrl && gallery.length) {
      return gallery.slice(1);
    }
    return gallery;
  }

  trackImage(_index: number, image: string): string {
    return image;
  }

  getProductNumber(product: Product): string {
    if (typeof product.sequence === 'number') {
      return product.sequence.toString().padStart(6, '0');
    }

    return product.id;
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

  selectUnit(type: ProductUnitType): void {
    this.selectedUnitType.set(type);
  }

  isSelectedUnit(product: Product, option: ProductUnitOption): boolean {
    return this.getSelectedUnitType(product) === option.type;
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

  selectColor(color: string): void {
    this.selectedColor.set(color);
  }

  isSelectedColor(product: Product, color: string): boolean {
    return this.getSelectedColor(product) === color;
  }

  getSelectedColor(product: Product): string | null {
    const current = this.selectedColor();
    if (current && this.getAvailableColors(product).includes(current)) {
      return current;
    }
    const defaultColor = this.getAvailableColors(product)[0];
    return defaultColor ?? null;
  }

  private getSelectedUnitOption(product: Product): ProductUnitOption {
    const selectedType = this.getSelectedUnitType(product);
    const options = this.getAvailableUnitOptions(product);

    const fallbackOption =
      options[0] ?? ({ type: 'piece', price: product.price ?? 0 } as ProductUnitOption);

    return options.find((option) => option.type === selectedType) ?? fallbackOption;
  }

  private getSelectedUnitType(product: Product): ProductUnitType {
    const current = this.selectedUnitType();

    if (current) {
      const options = this.getAvailableUnitOptions(product);
      if (options.some((option) => option.type === current)) {
        return current;
      }
    }

    const defaultType = this.getAvailableUnitOptions(product)[0]?.type ?? 'piece';
    return defaultType;
  }

  private ensureDefaultUnit(product?: Product): void {
    if (!product) {
      this.selectedUnitType.set(null);
      this.selectedColor.set(null);

      return;
    }

    const current = this.selectedUnitType();
    if (current) {
      const options = this.getAvailableUnitOptions(product);
      if (options.some((option) => option.type === current)) {
        return;
      }
    }

    const defaultType = this.getAvailableUnitOptions(product)[0]?.type ?? 'piece';

    this.selectedUnitType.set(defaultType);
  }

  private ensureDefaultFabric(product?: Product): void {
    if (!product) {
      this.selectedFabricIndex.set(null);
      return;
    }

    const fabrics = this.getAvailableFabrics(product);
    const current = this.selectedFabricIndex();
    if (current !== null && fabrics[current]) {
      return;
    }

    this.selectedFabricIndex.set(fabrics.length ? 0 : null);
  }

  private ensureDefaultColor(product?: Product): void {
    if (!product) {
      this.selectedColor.set(null);
      return;
    }

    const colors = this.getAvailableColors(product);
    if (!colors.length) {
      this.selectedColor.set(null);
      return;
    }

    const current = this.selectedColor();
    if (current && colors.includes(current)) {
      return;
    }

    this.selectedColor.set(colors[0]);
  }

  getAvailableFabrics(product: Product): ProductFabric[] {
    return getProductFabrics(product);
  }

  selectFabric(product: Product, index: number): void {
    this.selectedFabricIndex.set(index);
    this.selectedColor.set(null);
    this.ensureDefaultUnit(product);
    this.ensureDefaultColor(product);
  }

  isSelectedFabric(product: Product, index: number): boolean {
    return this.getSelectedFabricIndex(product) === index;
  }

  private getSelectedFabric(product: Product): ProductFabric | null {
    const fabrics = this.getAvailableFabrics(product);
    const index = this.getSelectedFabricIndex(product);
    if (index === null) {
      return fabrics[0] ?? null;
    }
    return fabrics[index] ?? fabrics[0] ?? null;
  }

  private getSelectedFabricIndex(product: Product): number | null {
    const current = this.selectedFabricIndex();
    const fabrics = this.getAvailableFabrics(product);
    if (current !== null && fabrics[current]) {
      return current;
    }
    return fabrics.length ? 0 : null;
  }
}
