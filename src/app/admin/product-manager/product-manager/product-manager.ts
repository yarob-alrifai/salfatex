import { AsyncPipe, CommonModule, CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { AdminDataService } from '../../admin-data.service';
import { Product } from '../../models/product.model';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// interface Product {
//   imageUrl: string;
//   name: string;
//   color: string;
//   categoryName: string;
//   price: number;
//   createdAt: Date;
// }

@Component({
  selector: 'app-product-manager',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf,
    NgFor,
    AsyncPipe,
    CurrencyPipe,
    CommonModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './product-manager.html',
  styleUrls: ['./product-manager.scss'],
})
export class ProductManagerComponent implements OnInit {
  displayedColumns: string[] = [
    'image',
    'name',
    'color',
    'category',
    'price',
    'createdAt',
    'actions',
  ];
  dataSource = new MatTableDataSource<Product>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    color: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    categoryId: ['', Validators.required],
    subcategoryId: [''],
  });

  private mainImage: File | null = null;
  private galleryImages: File[] = [];

  readonly feedback = signal('');

  readonly categories$ = this.adminDataService.categories$;
  readonly subcategories$ = this.adminDataService.subcategories$;
  readonly products$ = this.adminDataService.products$;

  ngOnInit(): void {
    // ربط المنتجات بالـ datasource
    this.products$.pipe(takeUntilDestroyed()).subscribe((products) => {
      this.dataSource.data = products;
    });
  }

  readonly filteredSubcategories$ = combineLatest([
    this.subcategories$,
    this.form.controls.categoryId.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([subcategories, categoryId]) =>
      categoryId ? subcategories.filter((item) => item.categoryId === categoryId) : subcategories
    )
  );

  onMainImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.mainImage = input.files?.[0] ?? null;
  }

  onGalleryChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.galleryImages = input.files ? Array.from(input.files) : [];
  }

  async saveProduct() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedback.set('');

    const { price, ...rest } = this.form.getRawValue();

    try {
      await this.adminDataService.createProduct(
        { ...rest, price: Number(price) },
        this.mainImage ?? undefined,
        this.galleryImages
      );
      this.form.reset();
      this.mainImage = null;
      this.galleryImages = [];
      this.feedback.set('تم إنشاء المنتج بنجاح.');
    } catch (error: any) {
      this.feedback.set(error?.message ?? 'لم يتم حفظ المنتج.');
    }
  }

  async deleteProduct(product: Product) {
    if (!product.id) {
      return;
    }

    await this.adminDataService.deleteProduct(product.id);
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
}
