import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';
import { Category, CategoryGroup, Subcategory } from '../../models/catalog.models';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './categories.html',
  styleUrls: ['./categories.scss'],
})
export class CategoriesComponent {
  private readonly catalogService = inject(CatalogService);

  readonly categoryGroups$: Observable<CategoryGroupViewModel[]> = combineLatest([
    this.catalogService.getCategoryGroups(),
    this.catalogService.getCategories(),
    this.catalogService.getAllSubcategories(),
    this.catalogService.getAllProducts(),
  ]).pipe(
    map(([groups, categories, subcategories, products]) =>
      groups
        .map((group) => {
          const groupCategories = categories
            .filter((category) => category.groupId === group.id)
            .map((category) => {
              const relatedSubcategories = subcategories
                .filter((subcategory) => subcategory.categoryId === category.id)
                .sort((a, b) => a.name.localeCompare(b.name));
              const productCount = products.filter(
                (product) => product.categoryId === category.id
              ).length;

              return {
                ...category,
                subcategories: relatedSubcategories,
                subcategoryCount: relatedSubcategories.length,
                productCount,
              } satisfies CategoryWithDetails;
            });

          return {
            ...group,
            categories: groupCategories,
          } satisfies CategoryGroupViewModel;
        })
        .filter((group) => group.categories.length > 0)
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  trackGroup(_: number, group: CategoryGroupViewModel): string {
    return group.id;
  }

  trackCategory(_: number, category: CategoryWithDetails): string {
    return category.id;
  }

  trackSubcategory(_: number, subcategory: Subcategory): string {
    return subcategory.id;
  }
}

type CategoryGroupViewModel = CategoryGroup & {
  categories: CategoryWithDetails[];
};

type CategoryWithDetails = Category & {
  subcategories: Subcategory[];

  subcategoryCount: number;
  productCount: number;
};
