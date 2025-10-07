import { AsyncPipe, CommonModule, CurrencyPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, startWith } from 'rxjs';
import { AdminDataService } from '../../admin-data.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-manager',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, NgClass, AsyncPipe, CurrencyPipe, CommonModule],
  templateUrl: './product-manager.html',
  styleUrls: ['./product-manager.scss'],
})
export class ProductManagerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    color: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    categoryId: ['', Validators.required],
    subcategoryId: [''],
  });

  private mainImage: File | null = null;
  private galleryImages: File[] = [];

  readonly feedback = signal('');

  readonly pageSize = 10;
  private readonly pageIndexSubject = new BehaviorSubject(0);
  private readonly pageIndex$ = this.pageIndexSubject.asObservable();

  readonly searchControl = new FormControl('', { nonNullable: true });

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

  private readonly searchTerm$ = this.searchControl.valueChanges.pipe(
    startWith(this.searchControl.value)
  );

  readonly productsView$ = combineLatest([
    this.products$,
    this.categories$,
    this.subcategories$,
    this.searchTerm$,
    this.pageIndex$,
  ]).pipe(
    map(([products, categories, subcategories, searchTerm, pageIndex]) => {
      type ProductWithCategory = Product & {
        categoryName?: string;
        subcategoryName?: string;
      };

      const normalizedSearch = searchTerm.trim().toLowerCase();
      const enriched: ProductWithCategory[] = products.map((product) => ({
        ...product,
        categoryName: categories.find((category) => category.id === product.categoryId)?.name,
        subcategoryName: subcategories.find(
          (subcategory) => subcategory.id === product.subcategoryId
        )?.name,
      }));

      const filtered = normalizedSearch
        ? enriched.filter((product) => {
            const fields: Array<string | number | undefined | null> = [
              product.name,
              product.description,
              product.color,
              product.categoryName,
              product.subcategoryName,
              product.price,
              product.id,
              product.mainImageUrl,
              product.galleryUrls?.join(' '),
            ];

            return fields.some((field) =>
              String(field ?? '')
                .toLowerCase()
                .includes(normalizedSearch)
            );
          })
        : enriched;

      const total = filtered.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / this.pageSize);
      const safePageIndex = totalPages ? Math.min(pageIndex, totalPages - 1) : 0;
      const start = total ? safePageIndex * this.pageSize + 1 : 0;
      const end = total ? Math.min(safePageIndex * this.pageSize + this.pageSize, total) : 0;
      const items = filtered.slice(
        safePageIndex * this.pageSize,
        safePageIndex * this.pageSize + this.pageSize
      );

      return {
        items,
        total,
        totalPages,
        pageIndex: safePageIndex,
        startIndex: start,
        endIndex: end,
        pages: totalPages ? Array.from({ length: totalPages }, (_, index) => index) : [],
      };
    })
  );

  readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    color: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    categoryId: ['', Validators.required],
    subcategoryId: [''],
  });

  readonly editFilteredSubcategories$ = combineLatest([
    this.subcategories$,
    this.editForm.controls.categoryId.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([subcategories, categoryId]) =>
      categoryId ? subcategories.filter((item) => item.categoryId === categoryId) : subcategories
    )
  );

  editingProduct: (Product & { categoryName?: string; subcategoryName?: string }) | null = null;
  isEditModalOpen = false;
  editGalleryUrls: string[] = [];
  editNewGalleryFiles: File[] = [];
  editMainImageFile: File | null = null;
  editFeedback = '';

  constructor() {
    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.pageIndexSubject.next(0));
  }

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

  openEdit(product: Product & { categoryName?: string; subcategoryName?: string }) {
    this.isEditModalOpen = true;
    this.editingProduct = product;
    this.editForm.setValue({
      name: product.name ?? '',
      color: product.color ?? '',
      description: product.description ?? '',
      price: product.price ?? 0,
      categoryId: product.categoryId ?? '',
      subcategoryId: product.subcategoryId ?? '',
    });
    this.editGalleryUrls = [...(product.galleryUrls ?? [])];
    this.editNewGalleryFiles = [];
    this.editMainImageFile = null;
    this.editFeedback = '';
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editingProduct = null;
    this.editForm.reset({
      name: '',
      color: '',
      description: '',
      price: 0,
      categoryId: '',
      subcategoryId: '',
    });
    this.editGalleryUrls = [];
    this.editNewGalleryFiles = [];
    this.editMainImageFile = null;
    this.editFeedback = '';
  }

  onEditMainImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editMainImageFile = input.files?.[0] ?? null;
  }

  clearEditMainImage() {
    this.editMainImageFile = null;
  }

  onEditGalleryChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editNewGalleryFiles = input.files ? Array.from(input.files) : [];
  }

  removeExistingGalleryImage(url: string) {
    this.editGalleryUrls = this.editGalleryUrls.filter((item) => item !== url);
  }

  removeNewGalleryImage(index: number) {
    this.editNewGalleryFiles = this.editNewGalleryFiles.filter((_, i) => i !== index);
  }

  goToPage(index: number, totalPages: number) {
    if (!totalPages) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, totalPages - 1));
    this.pageIndexSubject.next(safeIndex);
  }

  async saveProductEdits() {
    if (this.editForm.invalid || !this.editingProduct?.id) {
      this.editForm.markAllAsTouched();
      return;
    }

    const { price, ...rest } = this.editForm.getRawValue();

    try {
      await this.adminDataService.updateProduct(
        this.editingProduct.id,
        { ...rest, price: Number(price) },
        this.editMainImageFile ?? undefined,
        this.editNewGalleryFiles,
        this.editGalleryUrls
      );
      this.closeEditModal();
    } catch (error: any) {
      this.editFeedback = error?.message ?? 'لم يتم حفظ التعديلات.';
    }
  }
}
