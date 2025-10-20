import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CategoriesComponent } from '../../categories/categories/categories';
import { FormsModule } from '@angular/forms';
import { Category, CategoryGroup, Product } from 'src/app/models/catalog.models';
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
  imports: [CommonModule, RouterModule, FormsModule, CategoriesComponent],
  templateUrl: './home-page.html',
  styleUrls: ['./home-page.scss'],
})
export class HomePageComponent {
  private readonly catalog = inject(CatalogService);
  private readonly searchTermSubject = new BehaviorSubject<string>('');

  readonly searchTerm$ = this.searchTermSubject.asObservable();
  readonly searchResults$: Observable<SearchViewModel> = this.searchTerm$.pipe(
    debounceTime(250),
    map((term) => term.trim()),
    distinctUntilChanged(),
    switchMap((term) => {
      if (!term) {
        return of({ term: '', results: [], hasSearched: false, isLoading: false });
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

  readonly featuredGroups$: Observable<FeaturedCategoryGroup[]> = combineLatest([
    this.catalog.getCategoryGroups(),
    this.catalog.getCategories(),
    this.catalog.getAllProducts(),
  ]).pipe(
    map(([groups, categories, products]) => {
      const sortedProducts = [...products].sort((a, b) => {
        const aSequence = a.sequence ?? Number.MAX_SAFE_INTEGER;
        const bSequence = b.sequence ?? Number.MAX_SAFE_INTEGER;

        if (aSequence !== bSequence) {
          return aSequence - bSequence;
        }

        return a.name.localeCompare(b.name);
      });

      return groups
        .map((group) => {
          const groupCategories = categories.filter((category) => category.groupId === group.id);
          const categoryIds = new Set(groupCategories.map((category) => category.id));
          const groupProducts = sortedProducts.filter((product) =>
            categoryIds.has(product.categoryId)
          );

          return {
            ...group,
            categories: groupCategories,
            products: groupProducts.slice(0, 6),
          } satisfies FeaturedCategoryGroup;
        })
        .filter((group) => group.categories.length > 0);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  searchTerm = '';

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.searchTermSubject.next(term);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.searchTermSubject.next(this.searchTerm);
  }

  trackProduct(_: number, product: Product): string {
    return product.id;
  }

  trackGroup(_: number, group: FeaturedCategoryGroup): string {
    return group.id;
  }

  trackGroupProduct(_: number, product: Product): string {
    return product.id;
  }

  formatCategoryNames(group: FeaturedCategoryGroup): string {
    return group.categories.map((category) => category.name).join('، ');
  }

  getMinimumPrice(product: Product): number {
    if (product.unitOptions?.length) {
      return Math.min(...product.unitOptions.map((option) => option.price));
    }
    return product.price;
  }
}

interface SearchViewModel {
  term: string;
  results: Product[];
  hasSearched: boolean;
  isLoading: boolean;
}

interface FeaturedCategoryGroup extends CategoryGroup {
  categories: Category[];
  products: Product[];
}
