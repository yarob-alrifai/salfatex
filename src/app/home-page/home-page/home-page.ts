import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CategoriesComponent } from '../../categories/categories/categories';
import { FormsModule } from '@angular/forms';
import { Product } from 'src/app/models/catalog.models';
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  map,
  Observable,
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
