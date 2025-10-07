import { AsyncPipe, CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDataService } from '../../admin-data.service';
import { Category } from '../../models/category.model';
import { combineLatest, map, startWith } from 'rxjs';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe, CommonModule],
  templateUrl: './category-manager.html',
  styleUrls: ['./category-manager.scss'],
})
export class CategoryManagerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);

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

  onImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.imageFile = input.files?.[0] ?? null;
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
      this.imageFile = null;
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
    this.editImageFile = null;
    this.isEditModalOpen.set(true);
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
    this.selectedCategory.set(null);
    this.editForm.reset({ name: '', description: '' });
    this.editImageFile = null;
    this.editFeedback.set('');
  }

  onEditImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editImageFile = input.files?.[0] ?? null;
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
}
