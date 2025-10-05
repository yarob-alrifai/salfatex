import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, firstValueFrom } from 'rxjs';
import { Storage, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';

export interface Category {
  id?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt?: Timestamp;
}

export interface Subcategory {
  id?: string;
  name: string;
  description?: string;
  categoryId: string;
  imageUrl?: string;
  createdAt?: Timestamp;
}

export interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  subcategoryId?: string;
  mainImageUrl?: string;
  galleryUrls?: string[];
  createdAt?: Timestamp;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface AdminOrder {
  id?: string;
  customerName: string;
  customerEmail?: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  createdAt: Timestamp;
  notes?: string;
  items: OrderItem[];
  shippingAddress?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminDataService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  readonly categories$: Observable<Category[]> = collectionData(
    query(collection(this.firestore, 'categories'), orderBy('createdAt', 'desc')),
    { idField: 'id' }
  ) as Observable<Category[]>;

  readonly subcategories$: Observable<Subcategory[]> = collectionData(
    query(collection(this.firestore, 'subcategories'), orderBy('createdAt', 'desc')),
    { idField: 'id' }
  ) as Observable<Subcategory[]>;

  readonly products$: Observable<Product[]> = collectionData(
    query(collection(this.firestore, 'products'), orderBy('createdAt', 'desc')),
    { idField: 'id' }
  ) as Observable<Product[]>;

  readonly orders$: Observable<AdminOrder[]> = collectionData(
    query(collection(this.firestore, 'orders'), orderBy('createdAt', 'desc')),
    { idField: 'id' }
  ) as Observable<AdminOrder[]>;

  async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'imageUrl'>, image?: File) {
    const payload: Category = {
      ...category,
      createdAt: Timestamp.now(),
    };

    if (image) {
      payload.imageUrl = await this.uploadFile(`categories/${this.createIdentifier()}`, image);
    }

    await addDoc(collection(this.firestore, 'categories'), payload);
  }

  async deleteCategory(categoryId: string) {
    await deleteDoc(doc(this.firestore, 'categories', categoryId));
  }

  async createSubcategory(
    subcategory: Omit<Subcategory, 'id' | 'createdAt' | 'imageUrl'>,
    image?: File
  ) {
    const payload: Subcategory = {
      ...subcategory,
      createdAt: Timestamp.now(),
    };

    if (image) {
      payload.imageUrl = await this.uploadFile(`subcategories/${this.createIdentifier()}`, image);
    }

    await addDoc(collection(this.firestore, 'subcategories'), payload);
  }

  async deleteSubcategory(subcategoryId: string) {
    await deleteDoc(doc(this.firestore, 'subcategories', subcategoryId));
  }

  async createProduct(
    product: Omit<Product, 'id' | 'createdAt' | 'mainImageUrl' | 'galleryUrls'>,
    mainImage?: File,
    galleryImages: File[] = []
  ) {
    const payload: Product = {
      ...product,
      createdAt: Timestamp.now(),
    };

    if (mainImage) {
      payload.mainImageUrl = await this.uploadFile(
        `products/main/${this.createIdentifier()}`,
        mainImage
      );
    }

    if (galleryImages.length) {
      payload.galleryUrls = [];

      for (const image of galleryImages) {
        const url = await this.uploadFile(`products/gallery/${this.createIdentifier()}`, image);
        payload.galleryUrls.push(url);
      }
    }

    await addDoc(collection(this.firestore, 'products'), payload);
  }

  async deleteProduct(productId: string) {
    await deleteDoc(doc(this.firestore, 'products', productId));
  }

  async updateOrderStatus(orderId: string, status: AdminOrder['status']) {
    await updateDoc(doc(this.firestore, 'orders', orderId), { status });
  }

  async updateOrder(orderId: string, changes: Partial<AdminOrder>) {
    await updateDoc(doc(this.firestore, 'orders', orderId), changes);
  }

  async deleteOrder(orderId: string) {
    await deleteDoc(doc(this.firestore, 'orders', orderId));
  }

  async getSubcategoriesByCategory(categoryId: string): Promise<Subcategory[]> {
    const subcategoryQuery = query(
      collection(this.firestore, 'subcategories'),
      where('categoryId', '==', categoryId)
    );

    return firstValueFrom(
      collectionData(subcategoryQuery, { idField: 'id' }) as Observable<Subcategory[]>
    );
  }

  private createIdentifier(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2);
  }

  private async uploadFile(path: string, file: File): Promise<string> {
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }
}
