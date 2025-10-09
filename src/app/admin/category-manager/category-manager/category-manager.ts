import { AsyncPipe, CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDataService } from '../../admin-data.service';
import { Category } from '../../models/category.model';
import { combineLatest, map, startWith } from 'rxjs';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe, CommonModule, ImageCropperComponent],
  templateUrl: './category-manager.html',
  styleUrls: ['./category-manager.scss'],
})
export class CategoryManagerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  readonly categories$ = this.adminDataService.categories$;
  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchTerm$ = this.searchControl.valueChanges.pipe(
    startWith(this.searchControl.value)
  );
  readonly filteredCategories$ = combineLatest([this.categories$, this.searchTerm$]).pipe(
    map(([categories, searchTerm]) => {
      const normalized = searchTerm.trim().toLowerCase();

      if (!normalized) {
        return categories;
      }

      return categories.filter((category) => {
        const fields: Array<string | undefined | null> = [
          category.name,
          category.description,
          category.id,
        ];

        return fields.some((field) =>
          String(field ?? '')
            .toLowerCase()
            .includes(normalized)
        );
      });
    })
  );
  readonly feedback = signal('');
  readonly editFeedback = signal('');
  readonly isEditModalOpen = signal(false);
  readonly selectedCategory = signal<Category | null>(null);

  private imageFile: File | null = null;
  private editImageFile: File | null = null;

  showMainCropper = false;
  mainImageChangedEvent: Event | null = null;
  mainCropReady = false;
  private mainCropBlob: Blob | null = null;
  private mainCropBase64: string | null = null;
  private mainCropObjectUrl: string | null = null;
  private mainImageName = '';
  mainPreviewUrl: SafeUrl | null = null;
  private mainPreviewObjectUrl: string | null = null;

  showEditCropper = false;
  editImageChangedEvent: Event | null = null;
  editCropReady = false;
  private editCropBlob: Blob | null = null;
  private editCropBase64: string | null = null;
  private editCropObjectUrl: string | null = null;
  private editImageName = '';
  editPreviewUrl: SafeUrl | null = null;
  private editPreviewObjectUrl: string | null = null;

  onImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.resetMainImageSelection();
      return;
    }

    this.mainImageChangedEvent = event;
    this.mainImageName = file.name;
    this.showMainCropper = true;
    this.mainCropReady = false;
    this.mainCropBlob = null;
    this.mainCropBase64 = null;
    if (this.mainCropObjectUrl) {
      URL.revokeObjectURL(this.mainCropObjectUrl);
      this.mainCropObjectUrl = null;
    }
  }

  cancelMainCrop() {
    this.showMainCropper = false;
    this.resetMainImageSelection();
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
      this.mainPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(event.objectUrl);
    } else if (event.base64) {
      this.mainPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(event.base64);
    } else {
      this.mainPreviewUrl = null;
    }
  }

  onMainImageLoaded() {
    this.mainCropReady = false;
  }

  onMainImageLoadFailed() {
    this.feedback.set('تعذر تحميل الصورة المختارة.');
    this.cancelMainCrop();
  }

  confirmMainCrop() {
    if (!this.mainCropReady) {
      return;
    }

    this.revokeMainPreviewObjectUrl();

    let file: File | null = null;

    if (this.mainCropBlob) {
      const mime = this.mainCropBlob.type || 'image/png';
      file = new File([this.mainCropBlob], this.mainImageName || 'cropped-image.png', {
        type: mime,
      });
    } else if (this.mainCropBase64) {
      file = this.createFileFromBase64(
        this.mainCropBase64,
        this.mainImageName || 'cropped-image.png'
      );
    }

    if (!file) {
      return;
    }

    this.imageFile = file;

    const previewUrl = URL.createObjectURL(file);
    this.mainPreviewObjectUrl = previewUrl;
    this.mainPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(previewUrl);

    this.showMainCropper = false;
    this.mainCropReady = false;
    this.mainImageChangedEvent = null;
    this.mainCropBlob = null;
    this.mainCropBase64 = null;
    if (this.mainCropObjectUrl) {
      URL.revokeObjectURL(this.mainCropObjectUrl);
      this.mainCropObjectUrl = null;
    }
    this.mainImageName = '';
  }

  async createCategory() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');

    try {
      await this.adminDataService.createCategory(
        this.form.getRawValue(),
        this.imageFile ?? undefined
      );
      this.form.reset({ name: '', description: '' });
      this.resetMainImageSelection();
      this.feedback.set('تم حفظ التصنيف بنجاح.');
    } catch (error: any) {
      this.feedback.set(error?.message ?? 'تعذر حفظ التصنيف.');
    }
  }

  async deleteCategory(category: Category) {
    if (!category.id) {
      return;
    }

    await this.adminDataService.deleteCategory(category.id);
  }

  openEdit(category: Category) {
    if (!category.id) {
      return;
    }

    this.selectedCategory.set(category);
    this.editForm.reset({
      name: category.name,
      description: category.description ?? '',
    });
    this.editFeedback.set('');
    this.resetEditImageSelection();
    this.isEditModalOpen.set(true);
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
    this.selectedCategory.set(null);
    this.editForm.reset({ name: '', description: '' });
    this.resetEditImageSelection();
    this.editFeedback.set('');
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

  async saveCategoryEdits() {
    const category = this.selectedCategory();

    if (!category?.id || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.editFeedback.set('');

    try {
      await this.adminDataService.updateCategory(
        category.id,
        this.editForm.getRawValue(),
        this.editImageFile ?? undefined
      );

      this.feedback.set('تم تحديث التصنيف بنجاح.');
      this.closeEditModal();
    } catch (error: any) {
      this.editFeedback.set(error?.message ?? 'تعذر حفظ التعديلات.');
    }
  }

  private resetMainImageSelection() {
    this.imageFile = null;
    this.mainImageChangedEvent = null;
    this.mainCropReady = false;
    this.mainCropBlob = null;
    this.mainCropBase64 = null;
    if (this.mainCropObjectUrl) {
      URL.revokeObjectURL(this.mainCropObjectUrl);
      this.mainCropObjectUrl = null;
    }
    this.mainImageName = '';
    this.mainPreviewUrl = null;
    this.revokeMainPreviewObjectUrl();
  }

  private resetEditImageSelection() {
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

  private revokeMainPreviewObjectUrl() {
    if (this.mainPreviewObjectUrl) {
      URL.revokeObjectURL(this.mainPreviewObjectUrl);
      this.mainPreviewObjectUrl = null;
    }
  }

  private revokeEditPreviewObjectUrl() {
    if (this.editPreviewObjectUrl) {
      URL.revokeObjectURL(this.editPreviewObjectUrl);
      this.editPreviewObjectUrl = null;
    }
  }
}
