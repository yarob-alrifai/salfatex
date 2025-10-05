import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { AdminDataService, Subcategory } from '../../admin-data.service';

@Component({
  selector: 'app-subcategory-manager',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe],
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

  async saveSubcategory() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');

    try {
      await this.adminDataService.createSubcategory(
        this.form.getRawValue(),
        this.imageFile ?? undefined
      );
      this.form.reset();
      this.imageFile = null;
      this.feedback.set('تم إنشاء التصنيف الفرعي.');
    } catch (error: any) {
      this.feedback.set(error?.message ?? 'لم يتم الحفظ.');
    }
  }

  onImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.imageFile = input.files?.[0] ?? null;
  }

  async deleteSubcategory(subcategory: Subcategory) {
    if (!subcategory.id) {
      return;
    }

    await this.adminDataService.deleteSubcategory(subcategory.id);
  }
}
