import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, startWith, switchMap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { Product } from '../../models/catalog.models';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './search-page.html',
  styleUrls: ['./search-page.scss'],
})
export class SearchPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly catalog = inject(CatalogService);

  readonly form = this.fb.group({
    term: [''],
    color: [''],
    maxPrice: [''],
  });

  readonly results$: Observable<Product[]> = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    switchMap((value) => {
      const hasPrice =
        value.maxPrice !== null && value.maxPrice !== undefined && value.maxPrice !== '';
      const parsedPrice = hasPrice ? Number(value.maxPrice) : undefined;

      return this.catalog.searchProducts(value.term ?? '', value.color ?? '', parsedPrice);
    })
  );

  onSubmit(): void {
    this.form.updateValueAndValidity();
  }

  onReset(): void {
    this.form.reset({ term: '', color: '', maxPrice: '' });
  }
}
