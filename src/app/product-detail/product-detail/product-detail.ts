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

  readonly product$: Observable<Product | undefined> = this.route.paramMap.pipe(
    map((params) => params.get('productId') ?? ''),
    switchMap((productId) => this.catalog.getProductById(productId)),
    tap((product) => this.ensureDefaultUnit(product))
  );

  addToCart(product: Product) {
    this.cart.addProduct(product, this.getSelectedUnitOption(product));
  }

  increment(product: Product) {
    this.cart.increment(product.id, this.getSelectedUnitType(product));
  }

  decrement(product: Product) {
    this.cart.decrement(product.id, this.getSelectedUnitType(product));
  }

  getQuantity(product: Product): number {
    return this.cart.getQuantity(product.id, this.getSelectedUnitType(product));
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
}
