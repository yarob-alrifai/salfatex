import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Observable, combineLatest, map } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { Category } from '../../models/catalog.models';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './categories.html',
  styleUrls: ['./categories.scss'],
})
export class CategoriesComponent {
  private readonly catalogService = inject(CatalogService);

  readonly categories$: Observable<CategorySummary[]> = combineLatest([
    this.catalogService.getCategories(),
    this.catalogService.getAllSubcategories(),
    this.catalogService.getAllProducts(),
  ]).pipe(
    map(([categories, subcategories, products]) =>
      categories.map((category) => {
        const subcategoryCount = subcategories.filter(
          (subcategory) => subcategory.categoryId === category.id
        ).length;
        const productCount = products.filter(
          (product) => product.categoryId === category.id
        ).length;

        return { ...category, subcategoryCount, productCount } satisfies CategorySummary;
      })
    )
  );
}

type CategorySummary = Category & {
  subcategoryCount: number;
  productCount: number;
};
