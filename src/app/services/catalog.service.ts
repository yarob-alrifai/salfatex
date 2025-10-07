import { inject, Injectable } from '@angular/core';
import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
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
      name: { ar: 'أقمشة فاخرة', ru: 'Элитные ткани' },
      description: {
        ar: 'مجموعة مختارة من الأقمشة الراقية للحفلات والمناسبات الخاصة.',
        ru: 'Подборка премиальных тканей для торжеств и особых случаев.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'seasonal-collections',
      name: { ar: 'مجموعات موسمية', ru: 'Сезонные коллекции' },
      description: {
        ar: 'أحدث تشكيلات الأقمشة الملونة لربيع وصيف هذا العام.',
        ru: 'Актуальные палитры тканей для весны и лета этого года.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'accessories',
      name: { ar: 'إكسسوارات الخياطة', ru: 'Швейная фурнитура' },
      description: {
        ar: 'أشرطة، أزرار، وخامات مساندة لإكمال تصميمك.',
        ru: 'Ленты, пуговицы и дополнительные материалы для завершения дизайна.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1606214174559-011cda8d08d5?auto=format&fit=crop&w=800&q=80',
    },
  ];

  private readonly subcategoriesFallback: Subcategory[] = [
    {
      id: 'velvet',
      categoryId: 'luxury-fabrics',
      name: { ar: 'مخمل إيطالي', ru: 'Итальянский бархат' },
      description: {
        ar: 'مخمل ناعم بملمس فاخر ولمعة خفيفة.',
        ru: 'Мягкий бархат с благородным блеском.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'silk',
      categoryId: 'luxury-fabrics',
      name: { ar: 'حرير طبيعي', ru: 'Натуральный шелк' },
      description: {
        ar: 'حرير ناعم مناسب للفساتين الفاخرة.',
        ru: 'Нежный шелк для вечерних платьев.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'linen',
      categoryId: 'seasonal-collections',
      name: { ar: 'كتان صيفي', ru: 'Летний лён' },
      description: {
        ar: 'كتان خفيف ومتنفس للأيام الحارة.',
        ru: 'Лёгкий и дышащий лён для тёплых дней.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'cotton',
      categoryId: 'seasonal-collections',
      name: { ar: 'قطن مطبوع', ru: 'Хлопок с принтом' },
      description: {
        ar: 'أقمشة قطنية بألوان مبهجة ونقوش عصرية.',
        ru: 'Яркий хлопок с современными узорами.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'buttons',
      categoryId: 'accessories',
      name: { ar: 'أزرار معدنية', ru: 'Металлические пуговицы' },
      description: {
        ar: 'أشكال متعددة من الأزرار المعدنية الكلاسيكية.',
        ru: 'Разнообразные классические металлические пуговицы.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1507914372361-1aab87e173c3?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'ribbons',
      categoryId: 'accessories',
      name: { ar: 'أشرطة ساتان', ru: 'Атласные ленты' },
      description: {
        ar: 'أشرطة ملونة للتزيين والحياكة اليدوية.',
        ru: 'Цветные атласные ленты для декора и ручного шитья.',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
    },
  ];

  private readonly productsFallback: Product[] = [
    {
      id: 'velvet-royal-blue',
      categoryId: 'luxury-fabrics',
      subcategoryId: 'velvet',
      name: { ar: 'مخمل أزرق ملكي', ru: 'Королевский синий бархат' },
      description: {
        ar: 'قماش مخمل بدرجة أزرق ملكي مع لمعان خفيف مثالي للفساتين.',
        ru: 'Бархат насыщенного синего оттенка с лёгким блеском для вечерних нарядов.',
      },
      price: 120,
      color: 'أزرق / Синий',
      images: [
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      ],
      materials: {
        ar: '80% فيسكوز، 20% حرير',
        ru: '80% вискоза, 20% шёлк',
      },
      features: [
        {
          ar: 'عرض القماش 140 سم',
          ru: 'Ширина полотна 140 см',
        },
        {
          ar: 'صنع في إيطاليا',
          ru: 'Произведено в Италии',
        },
      ],
    },
    {
      id: 'silk-rose',
      categoryId: 'luxury-fabrics',
      subcategoryId: 'silk',
      name: { ar: 'حرير وردي فاتح', ru: 'Нежно-розовый шелк' },
      description: {
        ar: 'حرير خفيف بلمسة ناعمة مناسب للقمصان والفساتين.',
        ru: 'Лёгкий шелк с мягким блеском для платьев и блуз.',
      },
      price: 95,
      color: 'وردي / Розовый',
      images: [
        'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&w=800&q=80',
      ],
      materials: {
        ar: '100% حرير طبيعي',
        ru: '100% натуральный шёлк',
      },
    },
    {
      id: 'linen-sand',
      categoryId: 'seasonal-collections',
      subcategoryId: 'linen',
      name: { ar: 'كتان بلون رملي', ru: 'Лён песочного цвета' },
      description: {
        ar: 'قماش كتان معالج ليكون أكثر نعومة مع الحفاظ على التهوية الممتازة.',
        ru: 'Обработанный лён, остающийся мягким и воздухопроницаемым.',
      },
      price: 45,
      color: 'بيج / Бежевый',
      images: [
        'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80',
      ],
    },
    {
      id: 'cotton-floral',
      categoryId: 'seasonal-collections',
      subcategoryId: 'cotton',
      name: { ar: 'قطن مزهر', ru: 'Хлопок с цветочным принтом' },
      description: {
        ar: 'قطن 100% بنقشة زهور مستوحاة من الطبيعة.',
        ru: 'Чистый хлопок с цветочным орнаментом, вдохновлённым природой.',
      },
      price: 32,
      color: 'متعدد الألوان / Многоцветный',
      images: [
        'https://images.unsplash.com/photo-1527515545085-5db817172677?auto=format&fit=crop&w=800&q=80',
      ],
    },
    {
      id: 'buttons-gold',
      categoryId: 'accessories',
      subcategoryId: 'buttons',
      name: { ar: 'أزرار ذهبية لامعة', ru: 'Блестящие золотые пуговицы' },
      description: {
        ar: 'مجموعة من ستة أزرار ذهبية منقوشة لإطلالة فاخرة.',
        ru: 'Набор из шести резных золотых пуговиц для роскошного образа.',
      },
      price: 15,
      color: 'ذهبي / Золотой',
      images: [
        'https://images.unsplash.com/photo-1507914372361-1aab87e173c3?auto=format&fit=crop&w=800&q=80',
      ],
    },
    {
      id: 'ribbons-pastel',
      categoryId: 'accessories',
      subcategoryId: 'ribbons',
      name: { ar: 'شريط ساتان باستيل', ru: 'Пастельная атласная лента' },
      description: {
        ar: 'لفات متعددة من أشرطة الساتان بألوان باستيل ناعمة.',
        ru: 'Набор атласных лент пастельных оттенков.',
      },
      price: 12,
      color: 'باستيل / Пастель',
      images: [
        'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
      ],
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
          ? product.name.ar.toLowerCase().includes(normalizedTerm) ||
            product.name.ru.toLowerCase().includes(normalizedTerm)
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
