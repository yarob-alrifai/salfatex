import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { AdminDataService } from '../../admin-data.service';
import { Subcategory } from '../../models/subcategory.model';
import { AsyncPipe, CommonModule, NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-subcategory-manager',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe, CommonModule],
  templateUrl: './subcategory-manager.html',
  styleUrls: ['./subcategory-manager.scss'],
})
export class SubcategoryManagerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    categoryId: ['', Validators.required],
  });

  private imageFile: File | null = null;
  readonly feedback = signal('');
  readonly imageFileName = signal('');
  readonly editingSubcategory = signal<Subcategory | null>(null);

  readonly categories$ = this.adminDataService.categories$;
  readonly subcategories$ = this.adminDataService.subcategories$;

  readonly filteredSubcategories$ = combineLatest([
    this.subcategories$,
    this.form.controls.categoryId.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([subcategories, categoryId]) =>
      categoryId ? subcategories.filter((item) => item.categoryId === categoryId) : subcategories
    )
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

  async saveSubcategory() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');

    const { name, description, categoryId } = this.form.getRawValue();
    const editing = this.editingSubcategory();

    try {
      if (editing?.id) {
        await this.adminDataService.updateSubcategory(
          editing.id,
          { name, description, categoryId },
          this.imageFile ?? undefined
        );
        this.feedback.set('تم تحديث التصنيف الفرعي.');
        this.editingSubcategory.set(null);
        this.resetForm(categoryId);
      } else {
        await this.adminDataService.createSubcategory(
          { name, description, categoryId },
          this.imageFile ?? undefined
        );
        this.feedback.set('تم إنشاء التصنيف الفرعي.');
        this.resetForm(categoryId);
      }
    } catch (error: any) {
      this.feedback.set(error?.message ?? 'لم يتم الحفظ.');
    }
  }

  onImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.imageFile = input.files?.[0] ?? null;
    this.imageFileName.set(this.imageFile?.name ?? '');
  }

  startEdit(subcategory: Subcategory) {
    this.editingSubcategory.set(subcategory);
    this.form.patchValue({
      name: subcategory.name,
      description: subcategory.description ?? '',
      categoryId: subcategory.categoryId,
    });
    this.imageFile = null;
    this.imageFileName.set('');
    this.feedback.set('');
  }

  cancelEdit() {
    const current = this.editingSubcategory();
    this.editingSubcategory.set(null);
    this.feedback.set('');
    this.resetForm(current?.categoryId);
  }

  async deleteSubcategory(subcategory: Subcategory) {
    if (!subcategory.id) {
      return;
    }

    if (this.editingSubcategory()?.id === subcategory.id) {
      this.cancelEdit();
    }

    await this.adminDataService.deleteSubcategory(subcategory.id);
  }

  private resetForm(categoryId?: string) {
    this.form.reset({
      name: '',
      description: '',
      categoryId: categoryId ?? '',
    });
    this.imageFile = null;
    this.imageFileName.set('');
  }
}
