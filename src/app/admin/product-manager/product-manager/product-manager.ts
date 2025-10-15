import { AsyncPipe, CommonModule, CurrencyPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, startWith } from 'rxjs';
import { AdminDataService } from '../../admin-data.service';
import { Product } from '../../models/product.model';
import { ImageCroppedEvent, ImageCropperComponent, LoadedImage } from 'ngx-image-cropper';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ProductUnitOption } from 'src/app/models/catalog.models';

interface UnitOptionsFormValue {
  pieceEnabled: boolean;
  piecePrice: number;
  bundleEnabled: boolean;
  bundlePrice: number;
  bundlePiecesCount: number;
  cartonEnabled: boolean;
  cartonPrice: number;
  cartonPiecesCount: number;
}

@Component({
  selector: 'app-product-manager',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf,
    NgFor,
    NgClass,
    AsyncPipe,
    CurrencyPipe,
    CommonModule,
    ImageCropperComponent,
  ],
  templateUrl: './product-manager.html',
  styleUrls: ['./product-manager.scss'],
})
export class ProductManagerComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly defaultUnitOptions: UnitOptionsFormValue = {
    pieceEnabled: true,
    piecePrice: 0,
    bundleEnabled: false,
    bundlePrice: 0,
    bundlePiecesCount: 0,
    cartonEnabled: false,
    cartonPrice: 0,
    cartonPiecesCount: 0,
  };
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    color: ['', Validators.required],
    description: ['', Validators.required],
    categoryId: ['', Validators.required],
    subcategoryId: [''],
    unitOptions: this.createUnitOptionsGroup(),
  });

  private mainImage: File | null = null;
  private readonly galleryImages: File[] = [];

  private mainImageOriginalName = '';
  mainImagePreview: SafeUrl | null = null;
  private mainPreviewUrl: string | null = null;

  showMainCropper = false;
  mainImageChangedEvent: Event | null = null;
  private mainCropBlob: Blob | null = null;
  private mainCropBase64: string | null = null;
  private mainCropObjectUrl: string | null = null;
  mainCropPreview: SafeUrl | null = null;
  mainCropReady = false;

  showGalleryCropper = false;
  private galleryCropQueue: File[] = [];
  currentGalleryFile: File | null = null;
  private currentGalleryBlob: Blob | null = null;
  private currentGalleryBase64: string | null = null;
  private currentGalleryObjectUrl: string | null = null;
  currentGalleryCropReady = false;
  galleryImagePreviews: SafeUrl[] = [];
  private galleryPreviewUrls: string[] = [];
  totalGalleryToCrop = 0;

  ngOnDestroy(): void {
    this.revokeMainPreviewUrl();
    this.clearMainCropState();
    this.clearGallerySelections();
    this.cancelGalleryCropping(false);
  }

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
    categoryId: ['', Validators.required],
    subcategoryId: [''],
    unitOptions: this.createUnitOptionsGroup(),
  });

  private createUnitOptionsGroup() {
    return this.fb.nonNullable.group({
      pieceEnabled: [this.defaultUnitOptions.pieceEnabled],
      piecePrice: [this.defaultUnitOptions.piecePrice, [Validators.min(0)]],
      bundleEnabled: [this.defaultUnitOptions.bundleEnabled],
      bundlePrice: [this.defaultUnitOptions.bundlePrice, [Validators.min(0)]],
      bundlePiecesCount: [this.defaultUnitOptions.bundlePiecesCount, [Validators.min(0)]],
      cartonEnabled: [this.defaultUnitOptions.cartonEnabled],
      cartonPrice: [this.defaultUnitOptions.cartonPrice, [Validators.min(0)]],
      cartonPiecesCount: [this.defaultUnitOptions.cartonPiecesCount, [Validators.min(0)]],
    });
  }

  private resetCreateForm() {
    this.form.reset({
      name: '',
      color: '',
      description: '',
      categoryId: '',
      subcategoryId: '',
      unitOptions: { ...this.defaultUnitOptions },
    });
  }

  private resetEditForm() {
    this.editForm.reset({
      name: '',
      color: '',
      description: '',
      categoryId: '',
      subcategoryId: '',
      unitOptions: { ...this.defaultUnitOptions },
    });
  }

  private buildUnitOptionsFormValue(
    options: ProductUnitOption[] | undefined,
    fallbackPrice: number
  ): UnitOptionsFormValue {
    const piece = options?.find((option) => option.type === 'piece');
    const bundle = options?.find((option) => option.type === 'bundle');
    const carton = options?.find((option) => option.type === 'carton');

    return {
      pieceEnabled: Boolean(piece) || !options?.length,
      piecePrice: piece?.price ?? fallbackPrice ?? options?.[0]?.price ?? 0,
      bundleEnabled: Boolean(bundle),
      bundlePrice: bundle?.price ?? 0,
      bundlePiecesCount: bundle?.piecesCount ?? 0,
      cartonEnabled: Boolean(carton),
      cartonPrice: carton?.price ?? 0,
      cartonPiecesCount: carton?.piecesCount ?? 0,
    };
  }

  private normalizeUnitOptions(value: UnitOptionsFormValue): {
    options: ProductUnitOption[];
    error?: string;
  } {
    const options: ProductUnitOption[] = [];

    if (value.pieceEnabled) {
      const price = Number(value.piecePrice);
      if (!Number.isFinite(price) || price <= 0) {
        return { options: [], error: 'يرجى إدخال سعر صالح للقطعة.' };
      }
      options.push({ type: 'piece', price });
    }

    if (value.bundleEnabled) {
      const price = Number(value.bundlePrice);
      if (!Number.isFinite(price) || price <= 0) {
        return { options: [], error: 'يرجى إدخال سعر صالح للمجموعة.' };
      }

      const piecesCount = Math.floor(Number(value.bundlePiecesCount));
      if (!Number.isFinite(piecesCount) || piecesCount <= 0) {
        return { options: [], error: 'يرجى إدخال عدد القطع في المجموعة.' };
      }

      options.push({ type: 'bundle', price, piecesCount });
    }

    if (value.cartonEnabled) {
      const price = Number(value.cartonPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return { options: [], error: 'يرجى إدخال سعر صالح للكرتونة.' };
      }

      const piecesCount = Math.floor(Number(value.cartonPiecesCount));
      if (!Number.isFinite(piecesCount) || piecesCount <= 0) {
        return { options: [], error: 'يرجى إدخال عدد القطع في الكرتونة.' };
      }

      options.push({ type: 'carton', price, piecesCount });
    }

    if (!options.length) {
      return { options: [], error: 'يجب اختيار وحدة بيع واحدة على الأقل.' };
    }

    return { options };
  }

  private resolveBasePrice(options: ProductUnitOption[]): number {
    return options.find((option) => option.type === 'piece')?.price ?? options[0]?.price ?? 0;
  }

  getUnitOptionLabel(option: ProductUnitOption): string {
    switch (option.type) {
      case 'bundle':
        return option.piecesCount ? `مجموعة (${option.piecesCount} قطعة)` : 'مجموعة';
      case 'carton':
        return option.piecesCount ? `كرتونة (${option.piecesCount} قطعة)` : 'كرتونة';
      default:
        return 'بالقطعة';
    }
  }

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
    const file = input.files?.[0];

    if (!file) {
      this.resetMainImage();
      return;
    }

    this.mainImageOriginalName = file.name;
    this.mainImageChangedEvent = event;
    this.mainCropReady = false;
    this.showMainCropper = true;
  }

  onMainImageCropped(event: ImageCroppedEvent) {
    this.mainCropBlob = event.blob ?? null;
    this.mainCropBase64 = event.base64 ?? null;
    this.mainCropReady = !!(this.mainCropBlob || this.mainCropBase64);

    if (this.mainCropObjectUrl) {
      URL.revokeObjectURL(this.mainCropObjectUrl);
      this.mainCropObjectUrl = null;
    }

    if (event.objectUrl) {
      this.mainCropObjectUrl = event.objectUrl;
      this.mainCropPreview = this.sanitizer.bypassSecurityTrustUrl(event.objectUrl);
    } else if (event.base64) {
      this.mainCropPreview = this.sanitizer.bypassSecurityTrustUrl(event.base64);
    } else {
      this.mainCropPreview = null;
    }
  }

  onMainImageLoaded(_: LoadedImage) {}

  confirmMainCrop() {
    if (!this.mainCropReady) {
      return;
    }

    let file: File | null = null;

    if (this.mainCropBlob) {
      const mime = this.mainCropBlob.type || 'image/png';
      file = new File([this.mainCropBlob], this.mainImageOriginalName || 'cropped-image.png', {
        type: mime,
      });
    } else if (this.mainCropBase64) {
      file = this.base64ToFile(
        this.mainCropBase64,
        this.mainImageOriginalName || 'cropped-image.png'
      );
    }

    if (!file) {
      return;
    }

    this.mainImage = file;
    this.revokeMainPreviewUrl();
    const previewUrl = URL.createObjectURL(file);
    this.mainPreviewUrl = previewUrl;
    this.mainImagePreview = this.sanitizer.bypassSecurityTrustUrl(previewUrl);
    this.clearMainCropState();
  }

  cancelMainCrop() {
    this.resetMainImage();
    this.clearMainCropState();
  }

  clearMainCropState() {
    this.showMainCropper = false;
    this.mainImageChangedEvent = null;
    this.mainCropBlob = null;
    this.mainCropBase64 = null;
    this.mainCropReady = false;
    this.mainCropPreview = null;

    if (this.mainCropObjectUrl) {
      URL.revokeObjectURL(this.mainCropObjectUrl);
      this.mainCropObjectUrl = null;
    }
  }

  resetMainImage() {
    this.mainImage = null;
    this.mainImagePreview = null;
    this.mainImageOriginalName = '';
    this.revokeMainPreviewUrl();
  }

  private revokeMainPreviewUrl() {
    if (this.mainPreviewUrl) {
      URL.revokeObjectURL(this.mainPreviewUrl);
      this.mainPreviewUrl = null;
    }
  }

  onGalleryChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    this.clearGallerySelections();
    this.galleryCropQueue = files;
    this.totalGalleryToCrop = files.length;

    if (!this.galleryCropQueue.length) {
      this.cancelGalleryCropping();
      return;
    }

    this.startNextGalleryCrop();
  }

  private startNextGalleryCrop() {
    if (!this.galleryCropQueue.length) {
      this.cancelGalleryCropping(false);
      return;
    }

    this.currentGalleryFile = this.galleryCropQueue.shift() ?? null;
    this.currentGalleryBlob = null;
    this.currentGalleryBase64 = null;
    this.currentGalleryCropReady = false;

    if (this.currentGalleryObjectUrl) {
      URL.revokeObjectURL(this.currentGalleryObjectUrl);
      this.currentGalleryObjectUrl = null;
    }
    this.showGalleryCropper = !!this.currentGalleryFile;
  }

  onGalleryImageCropped(event: ImageCroppedEvent) {
    this.currentGalleryBlob = event.blob ?? null;
    this.currentGalleryBase64 = event.base64 ?? null;
    this.currentGalleryCropReady = !!(this.currentGalleryBlob || this.currentGalleryBase64);

    if (this.currentGalleryObjectUrl) {
      URL.revokeObjectURL(this.currentGalleryObjectUrl);
      this.currentGalleryObjectUrl = null;
    }

    if (event.objectUrl) {
      this.currentGalleryObjectUrl = event.objectUrl;
    }
  }

  onGalleryImageLoaded(_: LoadedImage) {}

  confirmGalleryCrop() {
    if (!this.currentGalleryFile || !this.currentGalleryCropReady) {
      return;
    }

    let file: File | null = null;

    if (this.currentGalleryBlob) {
      const mime = this.currentGalleryBlob.type || 'image/png';
      file = new File(
        [this.currentGalleryBlob],
        this.currentGalleryFile.name || 'gallery-image.png',
        {
          type: mime,
        }
      );
    } else if (this.currentGalleryBase64) {
      file = this.base64ToFile(
        this.currentGalleryBase64,
        this.currentGalleryFile.name || 'gallery-image.png'
      );
    }

    if (!file) {
      return;
    }

    this.galleryImages.push(file);
    const previewUrl = URL.createObjectURL(file);
    this.galleryPreviewUrls.push(previewUrl);
    this.galleryImagePreviews = [
      ...this.galleryImagePreviews,
      this.sanitizer.bypassSecurityTrustUrl(previewUrl),
    ];
    this.startNextGalleryCrop();
  }

  skipCurrentGalleryImage() {
    this.startNextGalleryCrop();
  }

  cancelGalleryCropping(clearQueue: boolean = true) {
    if (clearQueue) {
      this.galleryCropQueue = [];
    }
    this.currentGalleryFile = null;
    this.currentGalleryBlob = null;
    this.currentGalleryBase64 = null;
    this.showGalleryCropper = false;
    this.currentGalleryCropReady = false;
    this.totalGalleryToCrop = this.galleryImages.length;

    if (this.currentGalleryObjectUrl) {
      URL.revokeObjectURL(this.currentGalleryObjectUrl);
      this.currentGalleryObjectUrl = null;
    }
  }

  removeGalleryImage(index: number) {
    this.galleryImages.splice(index, 1);
    const [removedUrl] = this.galleryPreviewUrls.splice(index, 1);
    if (removedUrl) {
      URL.revokeObjectURL(removedUrl);
    }
    this.galleryImagePreviews = this.galleryImagePreviews.filter((_, i) => i !== index);
    this.totalGalleryToCrop = this.galleryImages.length + this.galleryCropQueue.length;
  }

  private clearGallerySelections() {
    this.galleryImages.splice(0, this.galleryImages.length);
    this.galleryImagePreviews = [];
    this.galleryPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.galleryPreviewUrls = [];
  }

  private base64ToFile(base64: string, fileName: string): File {
    const [metadata, data] = base64.split(',');
    const mimeMatch = /data:(.*?);/.exec(metadata ?? '');
    const mime = mimeMatch?.[1] ?? 'image/png';
    const binary = atob(data ?? '');
    const array = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      array[i] = binary.charCodeAt(i);
    }

    return new File([array], fileName, { type: mime });
  }

  onMainImageLoadFailed() {
    this.feedback.set('تعذر تحميل الصورة المختارة. يرجى المحاولة مجددًا.');
    this.cancelMainCrop();
  }

  onGalleryImageLoadFailed() {
    this.feedback.set('تعذر تحميل إحدى صور المعرض. تم تخطيها.');
    this.skipCurrentGalleryImage();
  }
  async saveProduct() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');

    const { unitOptions: unitOptionsRaw, ...rest } = this.form.getRawValue();
    const { options, error } = this.normalizeUnitOptions(unitOptionsRaw);

    if (error) {
      this.feedback.set(error);
      return;
    }

    const basePrice = this.resolveBasePrice(options);
    try {
      await this.adminDataService.createProduct(
        { ...rest, price: basePrice, unitOptions: options },
        this.mainImage ?? undefined,
        this.galleryImages
      );
      this.resetCreateForm();
      this.resetMainImage();
      this.clearGallerySelections();
      this.cancelGalleryCropping();
      this.totalGalleryToCrop = 0;
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
      categoryId: product.categoryId ?? '',
      subcategoryId: product.subcategoryId ?? '',
      unitOptions: this.buildUnitOptionsFormValue(product.unitOptions, product.price ?? 0),
    });
    this.editGalleryUrls = [...(product.galleryUrls ?? [])];
    this.editNewGalleryFiles = [];
    this.editMainImageFile = null;
    this.editFeedback = '';
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editingProduct = null;

    this.resetEditForm();

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

    const { unitOptions: unitOptionsRaw, ...rest } = this.editForm.getRawValue();
    const { options, error } = this.normalizeUnitOptions(unitOptionsRaw);

    if (error) {
      this.editFeedback = error;
      return;
    }

    const basePrice = this.resolveBasePrice(options);

    try {
      await this.adminDataService.updateProduct(
        this.editingProduct.id,
        { ...rest, price: basePrice, unitOptions: options },
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
