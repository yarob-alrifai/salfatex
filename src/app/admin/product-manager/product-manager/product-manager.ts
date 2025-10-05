import { AsyncPipe, CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { AdminDataService, Product } from '../../admin-data.service';

@Component({
  selector: 'app-product-manager',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe, CurrencyPipe],
  templateUrl: './product-manager.html',
  styleUrls: ['./product-manager.scss'],
})
export class ProductManagerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    categoryId: ['', Validators.required],
    subcategoryId: [''],
  });

  private mainImage: File | null = null;
  private galleryImages: File[] = [];

  readonly feedback = signal('');

  readonly categories$ = this.adminDataService.categories$;
  readonly subcategories$ = this.adminDataService.subcategories$;
  readonly products$ = this.adminDataService.products$;

  readonly filteredSubcategories$ = combineLatest([
    this.subcategories$,
    this.form.controls.categoryId.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([subcategories, categoryId]) =>
      categoryId ? subcategories.filter((item) => item.categoryId === categoryId) : subcategories
    )
  );

  onMainImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.mainImage = input.files?.[0] ?? null;
  }

  onGalleryChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.galleryImages = input.files ? Array.from(input.files) : [];
  }

  async saveProduct() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');

    const { price, ...rest } = this.form.getRawValue();

    try {
      await this.adminDataService.createProduct(
        { ...rest, price: Number(price) },
        this.mainImage ?? undefined,
        this.galleryImages
      );
      this.form.reset();
      this.mainImage = null;
      this.galleryImages = [];
      this.feedback.set('تم إنشاء المنتج بنجاح.');
    } catch (error: any) {
      this.feedback.set(error?.message ?? 'لم يتم حفظ المنتج.');
    }
  }

  async deleteProduct(product: Product) {
    if (!product.id) {
      return;
    }

    await this.adminDataService.deleteProduct(product.id);
  }
}
