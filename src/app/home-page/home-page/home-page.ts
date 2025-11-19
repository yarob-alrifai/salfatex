import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CategoriesComponent } from '../../categories/categories/categories';
import { FormsModule } from '@angular/forms';
import { getProductMinimumPrice } from 'src/app/models/product-helpers';

import { Category, CategoryGroup, Product, Subcategory } from 'src/app/models/catalog.models';
import {
  BehaviorSubject,
  debounceTime,
  Observable,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { CatalogService } from 'src/app/services/catalog.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home-page.html',
  styleUrls: ['./home-page.scss'],
})
export class HomePageComponent {
  private readonly catalog = inject(CatalogService);
  private readonly searchTermSubject = new BehaviorSubject<string>('');

  /** ✅ FIXED: Define observable pipeline properly */
  readonly searchResults$: Observable<SearchViewModel> = this.searchTermSubject.pipe(
    debounceTime(250),
    map((term) => term.trim()),
    distinctUntilChanged(),
    switchMap((term) => {
      if (!term) {
        return of({
          term: '',
          results: [],
          hasSearched: false,
          isLoading: false,
        });
      }

      return this.catalog.searchProducts(term).pipe(
        map((products) => ({
          term,
          results: products,
          hasSearched: true,
          isLoading: false,
        })),
        startWith({ term, results: [], hasSearched: true, isLoading: true })
      );
    }),
    startWith({ term: '', results: [], hasSearched: false, isLoading: false }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** ✅ Featured groups observable */
  readonly featuredGroups$: Observable<FeaturedCategoryGroup[]> = combineLatest([
    this.catalog.getCategoryGroups(),
    this.catalog.getCategories(),
    this.catalog.getAllSubcategories(),
  ]).pipe(
    map(([groups, categories, subcategories]) =>
      groups
        .map((group) => {
          const groupCategories = categories
            .filter((category) => category.groupId === group.id)
            .map(
              (category) =>
                ({
                  ...category,
                  subcategories: subcategories
                    .filter((subcategory) => subcategory.categoryId === category.id)
                    .sort((a, b) => a.name.localeCompare(b.name)),
                } satisfies FeaturedCategory)
            );

          return {
            ...group,
            categories: groupCategories,
          } satisfies FeaturedCategoryGroup;
        })
        .filter((group) => group.categories.length > 0)
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** ✅ Form and handlers */
  searchTerm = '';

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.searchTermSubject.next(term);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.searchTermSubject.next(this.searchTerm);
  }

  /** ✅ TrackBy functions */
  trackProduct(_: number, product: Product): string {
    return product.id;
  }

  trackGroup(_: number, group: FeaturedCategoryGroup): string {
    return group.id;
  }

  trackGroupCategory(_: number, category: FeaturedCategory): string {
    return category.id;
  }

  trackSubcategory(_: number, subcategory: Subcategory): string {
    return subcategory.id;
  }

  /** ✅ Helper methods */
  formatCategoryNames(group: FeaturedCategoryGroup): string {
    return group.categories.map((category) => category.name).join(', ');
  }

  getMinimumPrice(product: Product): number {
    return getProductMinimumPrice(product);
  }
}

/** ✅ Supporting interfaces */
interface SearchViewModel {
  term: string;
  results: Product[];
  hasSearched: boolean;
  isLoading: boolean;
}

interface FeaturedCategoryGroup extends CategoryGroup {
  categories: FeaturedCategory[];
}

interface FeaturedCategory extends Category {
  subcategories: Subcategory[];
}
