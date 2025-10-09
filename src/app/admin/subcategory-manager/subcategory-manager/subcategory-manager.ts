import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { AdminDataService } from '../../admin-data.service';
import { Subcategory } from '../../models/subcategory.model';
import { AsyncPipe, CommonModule, NgFor, NgIf } from '@angular/common';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-subcategory-manager',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe, CommonModule, ImageCropperComponent],
  templateUrl: './subcategory-manager.html',
  styleUrls: ['./subcategory-manager.scss'],
})
export class SubcategoryManagerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    categoryId: ['', Validators.required],
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    categoryId: ['', Validators.required],
  });

  readonly feedback = signal('');
  readonly editFeedback = signal('');

  readonly editingSubcategory = signal<Subcategory | null>(null);
  readonly isEditModalOpen = signal(false);

  readonly categories$ = this.adminDataService.categories$;
  readonly subcategories$ = this.adminDataService.subcategories$;

  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchTerm$ = this.searchControl.valueChanges.pipe(
    startWith(this.searchControl.value)
  );

  readonly filteredSubcategories$ = combineLatest([
    this.subcategories$,
    this.form.controls.categoryId.valueChanges.pipe(startWith(this.form.controls.categoryId.value)),
    this.searchTerm$,
  ]).pipe(
    map(([subcategories, categoryId, searchTerm]) => {
      const filteredByCategory = categoryId
        ? subcategories.filter((item) => item.categoryId === categoryId)
        : subcategories;

      const normalizedSearch = searchTerm.trim().toLowerCase();

      if (!normalizedSearch) {
        return filteredByCategory;
      }

      return filteredByCategory.filter((subcategory) => {
        const fields: Array<string | undefined | null> = [
          subcategory.name,
          subcategory.description,
          subcategory.id,
        ];

        return fields.some((field) =>
          String(field ?? '')
            .toLowerCase()
            .includes(normalizedSearch)
        );
      });
    })
  );

  readonly subcategoriesView$ = combineLatest([this.filteredSubcategories$, this.categories$]).pipe(
    map(([subcategories, categories]) =>
      subcategories.map((subcategory) => ({
        ...subcategory,
        categoryName:
          categories.find((category) => category.id === subcategory.categoryId)?.name ??
          'غير معروف',
      }))
    )
  );

  private imageFile: File | null = null;
  private editImageFile: File | null = null;

  showCreateCropper = false;
  createImageChangedEvent: Event | null = null;
  createCropReady = false;
  private createCropBlob: Blob | null = null;
  private createCropBase64: string | null = null;
  private createCropObjectUrl: string | null = null;
  private createImageName = '';
  createPreviewUrl: SafeUrl | null = null;
  private createPreviewObjectUrl: string | null = null;

  showEditCropper = false;
  editImageChangedEvent: Event | null = null;
  editCropReady = false;
  private editCropBlob: Blob | null = null;
  private editCropBase64: string | null = null;
  private editCropObjectUrl: string | null = null;
  private editImageName = '';
  editPreviewUrl: SafeUrl | null = null;
  private editPreviewObjectUrl: string | null = null;

  async saveSubcategory() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');

    const { name, description, categoryId } = this.form.getRawValue();

    try {
      await this.adminDataService.createSubcategory(
        { name, description, categoryId },
        this.imageFile ?? undefined
      );
      this.feedback.set('تم إنشاء التصنيف الفرعي.');
      this.resetForm(categoryId);
    } catch (error: any) {
      this.feedback.set(error?.message ?? 'لم يتم الحفظ.');
    }
  }

  onImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.resetCreateImageSelection();
      return;
    }

    this.createImageChangedEvent = event;
    this.createImageName = file.name;
    this.showCreateCropper = true;
    this.createCropReady = false;
    this.createCropBlob = null;
    this.createCropBase64 = null;
    if (this.createCropObjectUrl) {
      URL.revokeObjectURL(this.createCropObjectUrl);
      this.createCropObjectUrl = null;
    }
  }

  cancelCreateCrop() {
    this.showCreateCropper = false;
    this.resetCreateImageSelection();
  }

  onCreateImageCropped(event: ImageCroppedEvent) {
    this.createCropBlob = event.blob ?? null;
    this.createCropBase64 = event.base64 ?? null;
    this.createCropReady = !!(this.createCropBlob || this.createCropBase64);

    if (this.createCropObjectUrl) {
      URL.revokeObjectURL(this.createCropObjectUrl);
      this.createCropObjectUrl = null;
    }

    if (event.objectUrl) {
      this.createCropObjectUrl = event.objectUrl;
      this.createPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(event.objectUrl);
    } else if (event.base64) {
      this.createPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(event.base64);
    } else {
      this.createPreviewUrl = null;
    }
  }

  onCreateImageLoaded() {
    this.createCropReady = false;
  }

  onCreateImageLoadFailed() {
    this.feedback.set('تعذر تحميل الصورة المختارة.');
    this.cancelCreateCrop();
  }

  confirmCreateCrop() {
    if (!this.createCropReady) {
      return;
    }

    this.revokeCreatePreviewObjectUrl();

    let file: File | null = null;

    if (this.createCropBlob) {
      const mime = this.createCropBlob.type || 'image/png';
      file = new File([this.createCropBlob], this.createImageName || 'cropped-image.png', {
        type: mime,
      });
    } else if (this.createCropBase64) {
      file = this.createFileFromBase64(
        this.createCropBase64,
        this.createImageName || 'cropped-image.png'
      );
    }

    if (!file) {
      return;
    }

    this.imageFile = file;

    const previewUrl = URL.createObjectURL(file);
    this.createPreviewObjectUrl = previewUrl;
    this.createPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(previewUrl);

    this.showCreateCropper = false;
    this.createCropReady = false;
    this.createImageChangedEvent = null;
    this.createCropBlob = null;
    this.createCropBase64 = null;
    if (this.createCropObjectUrl) {
      URL.revokeObjectURL(this.createCropObjectUrl);
      this.createCropObjectUrl = null;
    }
    this.createImageName = '';
  }

  startEdit(subcategory: Subcategory) {
    if (!subcategory.id) {
      return;
    }

    this.editingSubcategory.set(subcategory);

    this.editForm.reset({
      name: subcategory.name,
      description: subcategory.description ?? '',
      categoryId: subcategory.categoryId,
    });

    this.resetEditImageSelection();

    this.editFeedback.set('');
    this.isEditModalOpen.set(true);
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
    this.editingSubcategory.set(null);

    this.editForm.reset({ name: '', description: '', categoryId: '' });
    this.resetEditImageSelection();

    this.editFeedback.set('');
  }

  async deleteSubcategory(subcategory: Subcategory) {
    if (!subcategory.id) {
      return;
    }

    if (this.editingSubcategory()?.id === subcategory.id) {
      this.closeEditModal();
    }

    await this.adminDataService.deleteSubcategory(subcategory.id);
  }

  onEditImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.resetEditImageSelection();
      return;
    }

    this.editImageChangedEvent = event;
    this.editImageName = file.name;
    this.showEditCropper = true;
    this.editCropReady = false;
    this.editCropBlob = null;
    this.editCropBase64 = null;
    if (this.editCropObjectUrl) {
      URL.revokeObjectURL(this.editCropObjectUrl);
      this.editCropObjectUrl = null;
    }
  }

  cancelEditCrop() {
    this.showEditCropper = false;
    this.resetEditImageSelection();
  }

  onEditImageCropped(event: ImageCroppedEvent) {
    this.editCropBlob = event.blob ?? null;
    this.editCropBase64 = event.base64 ?? null;
    this.editCropReady = !!(this.editCropBlob || this.editCropBase64);

    if (this.editCropObjectUrl) {
      URL.revokeObjectURL(this.editCropObjectUrl);
      this.editCropObjectUrl = null;
    }

    if (event.objectUrl) {
      this.editCropObjectUrl = event.objectUrl;
      this.editPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(event.objectUrl);
    } else if (event.base64) {
      this.editPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(event.base64);
    } else {
      this.editPreviewUrl = null;
    }
  }

  onEditImageLoaded() {
    this.editCropReady = false;
  }

  onEditImageLoadFailed() {
    this.editFeedback.set('تعذر تحميل الصورة المختارة.');
    this.cancelEditCrop();
  }

  confirmEditCrop() {
    if (!this.editCropReady) {
      return;
    }

    this.revokeEditPreviewObjectUrl();

    let file: File | null = null;

    if (this.editCropBlob) {
      const mime = this.editCropBlob.type || 'image/png';
      file = new File([this.editCropBlob], this.editImageName || 'cropped-image.png', {
        type: mime,
      });
    } else if (this.editCropBase64) {
      file = this.createFileFromBase64(
        this.editCropBase64,
        this.editImageName || 'cropped-image.png'
      );
    }

    if (!file) {
      return;
    }

    this.editImageFile = file;

    const previewUrl = URL.createObjectURL(file);
    this.editPreviewObjectUrl = previewUrl;
    this.editPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(previewUrl);

    this.showEditCropper = false;
    this.editCropReady = false;
    this.editImageChangedEvent = null;
    this.editCropBlob = null;
    this.editCropBase64 = null;
    if (this.editCropObjectUrl) {
      URL.revokeObjectURL(this.editCropObjectUrl);
      this.editCropObjectUrl = null;
    }
    this.editImageName = '';
  }

  async saveSubcategoryEdits() {
    const subcategory = this.editingSubcategory();

    if (!subcategory?.id || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.editFeedback.set('');

    try {
      await this.adminDataService.updateSubcategory(
        subcategory.id,
        this.editForm.getRawValue(),
        this.editImageFile ?? undefined
      );

      this.feedback.set('تم تحديث التصنيف الفرعي.');
      this.closeEditModal();
    } catch (error: any) {
      this.editFeedback.set(error?.message ?? 'لم يتم حفظ التعديلات.');
    }
  }

  private resetForm(categoryId?: string) {
    this.form.reset({
      name: '',
      description: '',
      categoryId: categoryId ?? '',
    });

    this.resetCreateImageSelection();
  }

  private resetCreateImageSelection() {
    this.imageFile = null;

    this.createImageChangedEvent = null;
    this.createCropReady = false;
    this.createCropBlob = null;
    this.createCropBase64 = null;
    if (this.createCropObjectUrl) {
      URL.revokeObjectURL(this.createCropObjectUrl);
      this.createCropObjectUrl = null;
    }
    this.createImageName = '';
    this.createPreviewUrl = null;
    this.revokeCreatePreviewObjectUrl();
  }

  private resetEditImageSelection() {
    this.editImageFile = null;
    this.editImageChangedEvent = null;
    this.editCropReady = false;
    this.editCropBlob = null;
    this.editCropBase64 = null;
    if (this.editCropObjectUrl) {
      URL.revokeObjectURL(this.editCropObjectUrl);
      this.editCropObjectUrl = null;
    }
    this.editImageName = '';
    this.editPreviewUrl = null;
    this.revokeEditPreviewObjectUrl();
  }

  private createFileFromBase64(base64: string, fileName: string) {
    const [metadata, data] = base64.split(',');
    const mimeMatch = metadata?.match(/data:(.*?);/);
    const mimeType = mimeMatch?.[1] ?? 'image/png';
    const binary = atob(data ?? base64);
    const array = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }

    const name = fileName || `cropped-${Date.now()}.png`;
    return new File([array], name, { type: mimeType });
  }

  private revokeCreatePreviewObjectUrl() {
    if (this.createPreviewObjectUrl) {
      URL.revokeObjectURL(this.createPreviewObjectUrl);
      this.createPreviewObjectUrl = null;
    }
  }

  private revokeEditPreviewObjectUrl() {
    if (this.editPreviewObjectUrl) {
      URL.revokeObjectURL(this.editPreviewObjectUrl);
      this.editPreviewObjectUrl = null;
    }
  }
}
