import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDataService, Category } from '../../admin-data.service';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe],
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

  readonly categories$ = this.adminDataService.categories$;
  readonly feedback = signal('');
  private imageFile: File | null = null;

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
      this.form.reset();
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
}
