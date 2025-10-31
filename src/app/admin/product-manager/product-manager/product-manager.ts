import { AsyncPipe, CommonModule, CurrencyPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
  FormGroup,
} from '@angular/forms';
import { BehaviorSubject, combineLatest, map, startWith } from 'rxjs';
import { AdminDataService } from '../../admin-data.service';
import { Product } from '../../models/product.model';
import { ImageCroppedEvent, ImageCropperComponent, LoadedImage } from 'ngx-image-cropper';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

import { ProductFabric, ProductUnitOption } from 'src/app/models/catalog.models';
import { getProductFabrics } from 'src/app/models/product-helpers';

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

interface FabricFormValue {
  name: string;
  colors: string[];
  unitOptions: UnitOptionsFormValue;
}

type UnitOptionsFormGroup = FormGroup<{
  pieceEnabled: FormControl<boolean>;
  piecePrice: FormControl<number>;
  bundleEnabled: FormControl<boolean>;
  bundlePrice: FormControl<number>;
  bundlePiecesCount: FormControl<number>;
  cartonEnabled: FormControl<boolean>;
  cartonPrice: FormControl<number>;
  cartonPiecesCount: FormControl<number>;
}>;

type FabricFormGroup = FormGroup<{
  name: FormControl<string>;
  colors: FormArray<FormControl<string>>;
  unitOptions: UnitOptionsFormGroup;
}>;

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

    description: ['', Validators.required],
    categoryId: ['', Validators.required],
    subcategoryId: [''],

    fabrics: this.fb.array([this.createFabricGroup()], {
      validators: [this.atLeastOneFabric.bind(this)],
    }),
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
  readonly isSavingProduct = signal(false);
  readonly isUpdatingProduct = signal(false);
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
              product.colors?.join(' '),

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
    description: ['', Validators.required],
    categoryId: ['', Validators.required],
    subcategoryId: [''],

    fabrics: this.fb.array([this.createFabricGroup()], {
      validators: [this.atLeastOneFabric.bind(this)],
    }),
  });

  get createFabricControls(): FabricFormGroup[] {
    return (this.form.controls.fabrics as FormArray<FabricFormGroup>).controls;
  }

  get editFabricControls(): FabricFormGroup[] {
    return (this.editForm.controls.fabrics as FormArray<FabricFormGroup>).controls;
  }

  private createUnitOptionsGroup(
    value: UnitOptionsFormValue = { ...this.defaultUnitOptions }
  ): UnitOptionsFormGroup {
    return this.fb.nonNullable.group({
      pieceEnabled: [value.pieceEnabled],
      piecePrice: [value.piecePrice, [Validators.min(0)]],
      bundleEnabled: [value.bundleEnabled],
      bundlePrice: [value.bundlePrice, [Validators.min(0)]],
      bundlePiecesCount: [value.bundlePiecesCount, [Validators.min(0)]],
      cartonEnabled: [value.cartonEnabled],
      cartonPrice: [value.cartonPrice, [Validators.min(0)]],
      cartonPiecesCount: [value.cartonPiecesCount, [Validators.min(0)]],
    }) as UnitOptionsFormGroup;
  }

  private createFabricGroup(
    fabric?: Partial<ProductFabric>,
    fallbackPrice: number = 0,
    fallbackColors: string[] = ['']
  ): FabricFormGroup {
    const colors = fabric?.colors?.length ? fabric.colors : fallbackColors;
    const unitOptionsValue = this.buildUnitOptionsFormValue(fabric?.unitOptions, fallbackPrice);

    return this.fb.nonNullable.group({
      name: [fabric?.name ?? '', [Validators.required]],
      colors: this.createColorsArray(colors),
      unitOptions: this.createUnitOptionsGroup(unitOptionsValue),
    }) as FabricFormGroup;
  }

  private getFabricFormArray(target: 'create' | 'edit'): FormArray<FabricFormGroup> {
    return target === 'create'
      ? (this.form.controls.fabrics as FormArray<FabricFormGroup>)
      : (this.editForm.controls.fabrics as FormArray<FabricFormGroup>);
  }

  private resetCreateForm() {
    this.form.reset({
      name: '',
      description: '',
      categoryId: '',
      subcategoryId: '',
    });
    this.setFormFabrics(this.form);
  }

  private resetEditForm() {
    this.editForm.reset({
      name: '',
      description: '',
      categoryId: '',
      subcategoryId: '',
    });
    this.setFormFabrics(this.editForm);
  }

  private createColorControl(value: string = ''): FormControl<string> {
    return this.fb.control(value, { nonNullable: true, validators: [Validators.required] });
  }

  private atLeastOneColor(control: AbstractControl): ValidationErrors | null {
    const values = (control as FormArray<FormControl<string>>).value as string[];
    const hasColor = values.some((color) => color?.trim());
    return hasColor ? null : { colorRequired: true };
  }

  private atLeastOneFabric(control: AbstractControl): ValidationErrors | null {
    const fabrics = (control as FormArray<FabricFormGroup>).controls;
    return fabrics.length ? null : { fabricRequired: true };
  }

  private createColorsArray(values: string[] = ['']): FormArray<FormControl<string>> {
    const source = values.length ? values : [''];
    return new FormArray<FormControl<string>>(
      source.map((value) => this.createColorControl(value)),
      { validators: [this.atLeastOneColor.bind(this)] }
    );
  }

  private setFormFabrics(
    form: typeof this.form | typeof this.editForm,
    fabrics: ProductFabric[] = [],
    fallbackPrice: number = 0,
    fallbackColors: string[] = ['']
  ): void {
    const source = fabrics.length
      ? fabrics
      : [
          {
            name: '',
            colors: fallbackColors,
            unitOptions: [],
          },
        ];

    const controls = source.map((fabric, index) =>
      this.createFabricGroup(
        fabric,
        fabric.unitOptions?.[0]?.price ?? fallbackPrice,
        fabric.colors?.length ? fabric.colors : fallbackColors
      )
    );

    form.setControl(
      'fabrics',
      new FormArray<FabricFormGroup>(controls, {
        validators: [this.atLeastOneFabric.bind(this)],
      })
    );
  }

  getFabricColorControls(target: 'create' | 'edit', index: number): FormControl<string>[] {
    return this.getFabricFormArray(target).at(index).controls.colors.controls;
  }

  addFabric(target: 'create' | 'edit'): void {
    this.getFabricFormArray(target).push(this.createFabricGroup());
  }

  removeFabric(target: 'create' | 'edit', index: number): void {
    const fabrics = this.getFabricFormArray(target);
    if (fabrics.length <= 1) {
      const control = fabrics.at(0);
      control.controls.name.setValue('');
      control.controls.unitOptions.reset({ ...this.defaultUnitOptions });
      const colorsArray = control.controls.colors;
      while (colorsArray.length > 1) {
        colorsArray.removeAt(colorsArray.length - 1);
      }
      colorsArray.at(0).setValue('');
      return;
    }
    fabrics.removeAt(index);
  }

  addFabricColorControl(target: 'create' | 'edit', fabricIndex: number): void {
    this.getFabricFormArray(target).at(fabricIndex).controls.colors.push(this.createColorControl());
  }

  removeFabricColorControl(
    target: 'create' | 'edit',
    fabricIndex: number,
    colorIndex: number
  ): void {
    const colors = this.getFabricFormArray(target).at(fabricIndex).controls.colors;
    if (colors.length <= 1) {
      colors.at(0).reset('');

      return;
    }
    colors.removeAt(colorIndex);
  }

  private normalizeColors(colors: string[] = []): string[] {
    return colors.map((color) => color.trim()).filter(Boolean);
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

  private formatUnitError(message: string, context?: string): string {
    return context ? `${message} (${context})` : message;
  }

  private normalizeUnitOptions(
    value: UnitOptionsFormValue,
    context?: string
  ): {
    options: ProductUnitOption[];
    error?: string;
  } {
    const options: ProductUnitOption[] = [];

    if (value.pieceEnabled) {
      const price = Number(value.piecePrice);
      if (!Number.isFinite(price) || price <= 0) {
        return {
          options: [],
          error: this.formatUnitError('يرجى إدخال سعر صالح للقطعة.', context),
        };
      }
      options.push({ type: 'piece', price });
    }

    if (value.bundleEnabled) {
      const price = Number(value.bundlePrice);
      if (!Number.isFinite(price) || price <= 0) {
        return {
          options: [],
          error: this.formatUnitError('يرجى إدخال سعر صالح للمجموعة.', context),
        };
      }

      const piecesCount = Math.floor(Number(value.bundlePiecesCount));
      if (!Number.isFinite(piecesCount) || piecesCount <= 0) {
        return {
          options: [],
          error: this.formatUnitError('يرجى إدخال عدد القطع في المجموعة.', context),
        };
      }

      options.push({ type: 'bundle', price, piecesCount });
    }

    if (value.cartonEnabled) {
      const price = Number(value.cartonPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return {
          options: [],
          error: this.formatUnitError('يرجى إدخال سعر صالح للكرتونة.', context),
        };
      }

      const piecesCount = Math.floor(Number(value.cartonPiecesCount));
      if (!Number.isFinite(piecesCount) || piecesCount <= 0) {
        return {
          options: [],
          error: this.formatUnitError('يرجى إدخال عدد القطع في الكرتونة.', context),
        };
      }

      options.push({ type: 'carton', price, piecesCount });
    }

    if (!options.length) {
      return {
        options: [],
        error: this.formatUnitError('يجب اختيار وحدة بيع واحدة على الأقل.', context),
      };
    }

    return { options };
  }

  private normalizeFabrics(fabricsArray: FormArray<FabricFormGroup>): {
    fabrics: ProductFabric[];
    error?: string;
  } {
    const fabrics: ProductFabric[] = [];

    for (const control of fabricsArray.controls) {
      const { name, colors, unitOptions } = control.getRawValue();
      const trimmedName = name.trim();

      if (!trimmedName) {
        return { fabrics: [], error: 'يرجى إدخال اسم نوع القماش.' };
      }

      const normalizedColors = this.normalizeColors(colors);
      if (!normalizedColors.length) {
        return {
          fabrics: [],
          error: `يرجى إضافة لون واحد على الأقل لنوع القماش «${trimmedName}».`,
        };
      }

      const { options, error } = this.normalizeUnitOptions(
        unitOptions,
        `نوع القماش: ${trimmedName}`
      );

      if (error) {
        return { fabrics: [], error };
      }

      fabrics.push({ name: trimmedName, colors: normalizedColors, unitOptions: options });
    }

    if (!fabrics.length) {
      return { fabrics: [], error: 'يجب إضافة نوع قماش واحد على الأقل.' };
    }

    return { fabrics };
  }

  private collectFabricColors(fabrics: ProductFabric[]): string[] {
    return Array.from(
      new Set(
        fabrics
          .flatMap((fabric) => fabric.colors ?? [])
          .map((color) => color.trim())
          .filter(Boolean)
      )
    );
  }

  private resolveFabricsBasePrice(fabrics: ProductFabric[]): number {
    const prices = fabrics
      .flatMap((fabric) => fabric.unitOptions ?? [])
      .map((option) => option.price)
      .filter((price): price is number => Number.isFinite(price) && price > 0);

    if (!prices.length) {
      return 0;
    }

    return Math.min(...prices);
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
    if (this.form.invalid || this.isSavingProduct()) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');

    const { fabrics: _rawFabrics, ...rest } = this.form.getRawValue();
    const fabricsControl = this.getFabricFormArray('create');
    const { fabrics, error } = this.normalizeFabrics(fabricsControl);

    if (error) {
      this.feedback.set(error);
      return;
    }

    const basePrice = this.resolveFabricsBasePrice(fabrics);
    const allColors = this.collectFabricColors(fabrics);

    if (!allColors.length) {
      this.feedback.set('يرجى إضافة لون واحد على الأقل لكل نوع قماش.');
      return;
    }
    this.isSavingProduct.set(true);

    try {
      await this.adminDataService.createProduct(
        {
          ...rest,
          price: basePrice,

          unitOptions: fabrics[0]?.unitOptions ?? [],
          color: allColors[0],
          colors: allColors,
          fabrics,
        },
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
    } finally {
      this.isSavingProduct.set(false);
    }
  }

  async deleteProduct(product: Product) {
    if (!product.id) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm('هل أنت متأكد من أنك تريد حذف العنصر؟')) {
      return;
    }

    await this.adminDataService.deleteProduct(product.id);
  }

  openEdit(product: Product & { categoryName?: string; subcategoryName?: string }) {
    this.isEditModalOpen = true;
    this.editingProduct = product;
    this.editForm.patchValue({
      name: product.name ?? '',
      description: product.description ?? '',
      categoryId: product.categoryId ?? '',
      subcategoryId: product.subcategoryId ?? '',
    });

    const fabrics = getProductFabrics(product);
    const fallbackColors = this.collectFabricColors(fabrics);
    const fallbackPrice = product.price ?? this.resolveFabricsBasePrice(fabrics);
    this.setFormFabrics(
      this.editForm,
      fabrics,
      fallbackPrice,
      fallbackColors.length ? fallbackColors : ['']
    );
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
    if (this.editForm.invalid || !this.editingProduct?.id || this.isUpdatingProduct()) {
      this.editForm.markAllAsTouched();
      return;
    }

    const { fabrics: _rawFabrics, ...rest } = this.editForm.getRawValue();
    const fabricsControl = this.getFabricFormArray('edit');
    const { fabrics, error } = this.normalizeFabrics(fabricsControl);

    if (error) {
      this.editFeedback = error;
      return;
    }

    const basePrice = this.resolveFabricsBasePrice(fabrics);
    const allColors = this.collectFabricColors(fabrics);

    if (!allColors.length) {
      this.editFeedback = 'يرجى إضافة لون واحد على الأقل لكل نوع قماش.';
      return;
    }

    this.isUpdatingProduct.set(true);

    try {
      await this.adminDataService.updateProduct(
        this.editingProduct.id,
        {
          ...rest,
          price: basePrice,

          unitOptions: fabrics[0]?.unitOptions ?? [],
          color: allColors[0],
          colors: allColors,
          fabrics,
        },
        this.editMainImageFile ?? undefined,
        this.editNewGalleryFiles,
        this.editGalleryUrls
      );
      this.closeEditModal();
    } catch (error: any) {
      this.editFeedback = error?.message ?? 'لم يتم حفظ التعديلات.';
    } finally {
      this.isUpdatingProduct.set(false);
    }
  }
}
