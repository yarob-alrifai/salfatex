import { AsyncPipe, CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { combineLatest, map, startWith } from 'rxjs';
import { AdminDataService } from '../admin-data.service';
import { CategoryGroup } from '../models/category-group.model';

@Component({
  selector: 'app-category-group-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AsyncPipe, NgIf, NgFor],
  templateUrl: './category-group-manager.html',
  styleUrls: ['./category-group-manager.scss'],
})
export class CategoryGroupManagerComponent implements OnDestroy {
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

  readonly categoryGroups$ = this.adminDataService.categoryGroups$;
  readonly categories$ = this.adminDataService.categories$;
  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchTerm$ = this.searchControl.valueChanges.pipe(
    startWith(this.searchControl.value)
  );

  readonly filteredGroups$ = combineLatest([
    this.categoryGroups$,
    this.categories$,
    this.searchTerm$,
  ]).pipe(
    map(([groups, categories, searchTerm]) => {
      const normalized = searchTerm.trim().toLowerCase();
      const mapWithCount = (group: CategoryGroup): CategoryGroupListItem => ({
        ...group,
        categoryCount: categories.filter((category) => category.groupId === group.id).length,
      });

      if (!normalized) {
        return groups.map(mapWithCount);
      }

      return groups
        .filter((group) => {
          const fields: Array<string | undefined | null> = [
            group.name,
            group.description,
            group.id,
          ];

          return fields.some((field) =>
            String(field ?? '')
              .toLowerCase()
              .includes(normalized)
          );
        })
        .map(mapWithCount);
    })
  );

  readonly feedback = signal('');
  readonly editFeedback = signal('');
  readonly isEditModalOpen = signal(false);
  readonly selectedGroup = signal<CategoryGroupListItem | null>(null);
  readonly isCreatingGroup = signal(false);
  readonly isUpdatingGroup = signal(false);

  private imageFile: File | null = null;
  private imageObjectUrl: string | null = null;
  imagePreviewUrl: SafeUrl | null = null;

  private editImageFile: File | null = null;
  private editImageObjectUrl: string | null = null;
  editImagePreviewUrl: SafeUrl | null = null;

  ngOnDestroy(): void {
    this.revokeImageObjectUrl();
    this.revokeEditImageObjectUrl();
  }

  trackGroup(_: number, group: CategoryGroupListItem): string {
    return group.id ?? '';
  }

  async createCategoryGroup() {
    if (this.form.invalid || this.isCreatingGroup()) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');
    this.isCreatingGroup.set(true);

    try {
      await this.adminDataService.createCategoryGroup(
        this.form.getRawValue(),
        this.imageFile ?? undefined
      );
      this.form.reset({ name: '', description: '' });
      this.resetImageSelection();
      this.feedback.set('تم حفظ التصنيف الرئيسي بنجاح.');
    } catch (error: any) {
      this.feedback.set(error?.message ?? 'تعذر حفظ التصنيف الرئيسي.');
    } finally {
      this.isCreatingGroup.set(false);
    }
  }

  openEditModal(group: CategoryGroupListItem) {
    if (!group.id) {
      return;
    }

    this.selectedGroup.set(group);
    this.editForm.reset({
      name: group.name,
      description: group.description ?? '',
    });
    this.editFeedback.set('');
    this.resetEditImageSelection();
    this.isEditModalOpen.set(true);
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
    this.selectedGroup.set(null);
    this.editForm.reset({ name: '', description: '' });
    this.resetEditImageSelection();
    this.editFeedback.set('');
  }

  onImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.resetImageSelection();
      return;
    }

    this.imageFile = file;
    this.updateImagePreview(file);
  }

  onEditImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.resetEditImageSelection();
      return;
    }

    this.editImageFile = file;
    this.updateEditImagePreview(file);
  }

  async saveCategoryGroupEdits() {
    const group = this.selectedGroup();

    if (!group?.id || this.editForm.invalid || this.isUpdatingGroup()) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.editFeedback.set('');

    this.isUpdatingGroup.set(true);

    try {
      await this.adminDataService.updateCategoryGroup(
        group.id,
        this.editForm.getRawValue(),
        this.editImageFile ?? undefined
      );
      this.editFeedback.set('تم تحديث التصنيف الرئيسي بنجاح.');
      this.closeEditModal();
    } catch (error: any) {
      this.editFeedback.set(error?.message ?? 'تعذر حفظ التعديلات.');
    } finally {
      this.isUpdatingGroup.set(false);
    }
  }

  async deleteCategoryGroup(group: CategoryGroupListItem) {
    if (!group.id) {
      return;
    }

    if (
      typeof window !== 'undefined' &&
      !window.confirm('سيتم حذف التصنيف الرئيسي وفك ارتباط التصنيفات التابعة له. هل تريد المتابعة؟')
    ) {
      return;
    }

    await this.adminDataService.deleteCategoryGroup(group.id);
  }

  private resetImageSelection() {
    this.imageFile = null;
    this.revokeImageObjectUrl();
    this.imagePreviewUrl = null;
  }

  private resetEditImageSelection() {
    this.editImageFile = null;
    this.revokeEditImageObjectUrl();
    this.editImagePreviewUrl = null;
  }

  private updateImagePreview(file: File) {
    this.revokeImageObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    this.imageObjectUrl = objectUrl;
    this.imagePreviewUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
  }

  private updateEditImagePreview(file: File) {
    this.revokeEditImageObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    this.editImageObjectUrl = objectUrl;
    this.editImagePreviewUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
  }

  private revokeImageObjectUrl() {
    if (this.imageObjectUrl) {
      URL.revokeObjectURL(this.imageObjectUrl);
      this.imageObjectUrl = null;
    }
  }

  private revokeEditImageObjectUrl() {
    if (this.editImageObjectUrl) {
      URL.revokeObjectURL(this.editImageObjectUrl);
      this.editImageObjectUrl = null;
    }
  }
}

type CategoryGroupListItem = CategoryGroup & {
  categoryCount: number;
};
