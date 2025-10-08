import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { Category, Product, Subcategory } from '../models/catalog.models';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private firestore = inject(Firestore, { optional: true });

  private readonly categoriesFallback: Category[] = [
    {
      id: 'luxury-fabrics',

      name: 'أقمشة فاخرة',
      description: 'مجموعة مختارة من الأقمشة الراقية للحفلات والمناسبات الخاصة.',

      imageUrl:
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'seasonal-collections',

      name: 'أقمشة فاخرة',
      description: 'مجموعة مختارة من الأقمشة الراقية للحفلات والمناسبات الخاصة.',

      imageUrl:
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'accessories',

      name: 'أقمشة فاخرة',
      description: 'مجموعة مختارة من الأقمشة الراقية للحفلات والمناسبات الخاصة.',

      imageUrl:
        'https://images.unsplash.com/photo-1606214174559-011cda8d08d5?auto=format&fit=crop&w=800&q=80',
    },
  ];

  private readonly subcategoriesFallback: Subcategory[] = [
    {
      id: 'velvet',
      categoryId: 'luxury-fabrics',

      name: 'أقمشة فاخرة',
      description: 'مجموعة مختارة من الأقمشة الراقية للحفلات والمناسبات الخاصة.',

      imageUrl:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    },
  ];

  private readonly productsFallback: Product[] = [
    {
      id: 'velvet-royal-blue',
      categoryId: 'luxury-fabrics',
      subcategoryId: 'velvet',

      name: 'أقمشة فاخرة',
      description: 'مجموعة مختارة من الأقمشة الراقية للحفلات والمناسبات الخاصة.',

      price: 120,
      color: 'أزرق / Синий',
      mainImageUrl:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1606214174559-011cda8d08d5?auto=format&fit=crop&w=800&q=80',
      ],
      materials: '80% فيسكوز، 20% حرير',
      features: ['عرض القماش 140 سم', 'صنع في إيطاليا'],
    },
  ];

  getCategories(): Observable<Category[]> {
    if (this.firestore) {
      const ref = collection(this.firestore, 'categories');
      return collectionData(ref, { idField: 'id' }).pipe(
        map((docs) => docs as Category[]),
        catchError(() => of(this.categoriesFallback))
      );
    }
    return of(this.categoriesFallback);
  }

  getCategoryById(categoryId: string): Observable<Category | undefined> {
    return this.getCategories().pipe(
      map((categories) => categories.find((c) => c.id === categoryId))
    );
  }

  getSubcategoryById(subcategoryId: string): Observable<Subcategory | undefined> {
    if (this.firestore) {
      const ref = doc(this.firestore, 'subcategories', subcategoryId);
      return docData(ref, { idField: 'id' }).pipe(
        map((data) => data as Subcategory),
        catchError(() =>
          of(this.subcategoriesFallback.find((subcategory) => subcategory.id === subcategoryId))
        )
      );
    }

    return of(this.subcategoriesFallback.find((subcategory) => subcategory.id === subcategoryId));
  }

  getAllSubcategories(): Observable<Subcategory[]> {
    if (this.firestore) {
      const ref = collection(this.firestore, 'subcategories');
      return collectionData(ref, { idField: 'id' }).pipe(
        map((docs) => docs as Subcategory[]),
        catchError(() => of(this.subcategoriesFallback))
      );
    }

    return of(this.subcategoriesFallback);
  }

  getSubcategories(categoryId: string): Observable<Subcategory[]> {
    if (this.firestore) {
      const ref = query(
        collection(this.firestore, 'subcategories'),
        where('categoryId', '==', categoryId)
      );
      return collectionData(ref, { idField: 'id' }).pipe(
        map((docs) => docs as Subcategory[]),
        catchError(() => of(this.subcategoriesFallback.filter((s) => s.categoryId === categoryId)))
      );
    }
    return of(this.subcategoriesFallback.filter((s) => s.categoryId === categoryId));
  }

  getAllProducts(): Observable<Product[]> {
    if (this.firestore) {
      const ref = collection(this.firestore, 'products');
      return collectionData(ref, { idField: 'id' }).pipe(
        map((docs) => docs as Product[]),
        catchError(() => of(this.productsFallback))
      );
    }

    return of(this.productsFallback);
  }

  getProductById(productId: string): Observable<Product | undefined> {
    if (this.firestore) {
      const ref = collection(this.firestore, 'products');
      return collectionData(ref, { idField: 'id' }).pipe(
        map((docs) => (docs as Product[]).find((p) => p.id === productId)),
        catchError(() => of(this.productsFallback.find((p) => p.id === productId)))
      );
    }
    return of(this.productsFallback.find((p) => p.id === productId));
  }

  getProductsForSubcategory(categoryId: string, subcategoryId: string): Observable<Product[]> {
    if (this.firestore) {
      const ref = query(
        collection(this.firestore, 'products'),
        where('categoryId', '==', categoryId),
        where('subcategoryId', '==', subcategoryId)
      );
      return collectionData(ref, { idField: 'id' }).pipe(
        map((docs) => docs as Product[]),
        catchError(() =>
          of(
            this.productsFallback.filter(
              (product) =>
                product.categoryId === categoryId && product.subcategoryId === subcategoryId
            )
          )
        )
      );
    }

    return of(
      this.productsFallback.filter(
        (product) => product.categoryId === categoryId && product.subcategoryId === subcategoryId
      )
    );
  }

  searchProducts(term: string, color?: string, price?: number): Observable<Product[]> {
    const normalizedTerm = term.trim().toLowerCase();
    const normalizedColor = color?.trim().toLowerCase();

    const localFilter = (products: Product[]) =>
      products.filter((product) => {
        const matchesTerm = normalizedTerm
          ? product.name.toLowerCase().includes(normalizedTerm) ||
            product.description.toLowerCase().includes(normalizedTerm)
          : true;
        const matchesColor = normalizedColor
          ? product.color.toLowerCase().includes(normalizedColor)
          : true;
        const matchesPrice = price ? product.price <= price : true;
        return matchesTerm && matchesColor && matchesPrice;
      });

    if (this.firestore) {
      const ref = collection(this.firestore, 'products');
      return collectionData(ref, { idField: 'id' }).pipe(
        map((docs) => docs as Product[]),
        map(localFilter),
        catchError(() => of(localFilter(this.productsFallback)))
      );
    }

    return of(localFilter(this.productsFallback));
  }
}
