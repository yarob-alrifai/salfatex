import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, map, switchMap, tap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { Product, ProductUnitOption, ProductUnitType } from '../../models/catalog.models';
import { CartService } from '../../services/cart.service';
import { BackButtonComponent } from 'src/app/component/back-button/back-button';

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

  readonly quantity = signal(1);
  private readonly selectedUnitType = signal<ProductUnitType | null>(null);
  private readonly selectedColor = signal<string | null>(null);

  readonly product$: Observable<Product | undefined> = this.route.paramMap.pipe(
    map((params) => params.get('productId') ?? ''),
    switchMap((productId) => this.catalog.getProductById(productId)),
    tap((product) => {
      this.ensureDefaultUnit(product);
      this.ensureDefaultColor(product);
    })
  );

  addToCart(product: Product) {
    this.cart.addProduct(
      product,
      this.getSelectedUnitOption(product),
      this.getSelectedColor(product) ?? undefined
    );
  }

  increment(product: Product) {
    this.cart.increment(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product) ?? undefined
    );
  }

  decrement(product: Product) {
    this.cart.decrement(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product) ?? undefined
    );
  }

  getQuantity(product: Product): number {
    return this.cart.getQuantity(
      product.id,
      this.getSelectedUnitType(product),
      this.getSelectedColor(product) ?? undefined
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

  selectUnit(type: ProductUnitType): void {
    this.selectedUnitType.set(type);
  }

  isSelectedUnit(product: Product, option: ProductUnitOption): boolean {
    return this.getSelectedUnitType(product) === option.type;
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

  getSelectedUnitPrice(product: Product): number {
    return this.getSelectedUnitOption(product).price;
  }

  getAvailableColors(product: Product): string[] {
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
    return (
      options.find((option) => option.type === selectedType) ?? {
        type: 'piece',
        price: product.price,
      }
    );
  }

  private getSelectedUnitType(product: Product): ProductUnitType {
    const current = this.selectedUnitType();

    if (current) {
      const options = this.getAvailableUnitOptions(product);
      if (options.some((option) => option.type === current)) {
        return current;
      }
    }

    const defaultType = product.unitOptions?.[0]?.type;
    return defaultType ?? 'piece';
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

    const defaultType = product.unitOptions?.[0]?.type ?? 'piece';
    this.selectedUnitType.set(defaultType);
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
}
