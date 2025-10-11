import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, map, of, switchMap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { Category, Product, Subcategory } from '../../models/catalog.models';
import { CartService } from '../../services/cart.service';
import { FormsModule } from '@angular/forms';
import { BackButtonComponent } from 'src/app/component/back-button/back-button';

@Component({
  selector: 'app-subcategory-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BackButtonComponent],
  templateUrl: './subcategory-list.html',
  styleUrls: ['./subcategory-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcategoryListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);

  private readonly searchTermSubject = new BehaviorSubject<string>('');
  readonly searchTerm$ = this.searchTermSubject.asObservable();

  private readonly baseViewModel$: Observable<{
    category?: Category;
    items: Subcategory[];
  }> = this.route.paramMap.pipe(
    map((params) => params.get('categoryId') ?? ''),
    switchMap((categoryId) =>
      combineLatest([
        this.catalog.getCategoryById(categoryId),

        this.catalog.getSubcategories(categoryId),
      ]).pipe(map(([category, items]) => ({ category, items })))
    )
  );

  readonly viewModel$: Observable<{
    category?: Category;
    items: Subcategory[];
    filteredItems: Subcategory[];
    searchTerm: string;
  }> = combineLatest([this.baseViewModel$, this.searchTerm$]).pipe(
    map(([viewModel, searchTerm]) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const filteredItems = !normalizedSearch
        ? viewModel.items
        : viewModel.items.filter((item) => {
            const values = [item.name ?? '', item.description ?? ''];

            return values.some((value) => value.toLowerCase().includes(normalizedSearch));
          });

      return { ...viewModel, filteredItems, searchTerm };
    })
  );

  openSubcategory(subcategory: Subcategory): void {
    if (!subcategory.id || !subcategory.categoryId) {
      return;
    }

    this.router.navigate(['/categories', subcategory.categoryId, 'subcategories', subcategory.id]);
  }

  updateSearch(term: string): void {
    this.searchTermSubject.next(term);
  }
}
