import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteField,
  where,
  getDoc,
} from '@angular/fire/firestore';
import { Observable, firstValueFrom } from 'rxjs';
import { Storage, deleteObject, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';
import { Category } from './models/category.model';
import { Subcategory } from './models/subcategory.model';
import { Product } from './models/product.model';
import { ContactInfo, EMPTY_CONTACT_INFO } from '../models/contact-info.model';
import { ProductUnitType } from '../models/catalog.models';
import { CategoryGroup } from './models/category-group.model';

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  color?: string;
  unitType?: ProductUnitType;
  unitLabel?: string;
  unitPrice?: number;
  piecesCount?: number;
}

export interface AdminOrder {
  id?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  restaurantName?: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  createdAt: Timestamp;
  notes?: string;
  items: OrderItem[];
  shippingAddress?: string;
  orderNumber?: string;
  orderSequence?: number;
  orderMonth?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminDataService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  readonly categories$: Observable<Category[]> = collectionData(
    query(collection(this.firestore, 'categories'), orderBy('createdAt', 'desc')),
    { idField: 'id' }
  ) as Observable<Category[]>;

  readonly categoryGroups$: Observable<CategoryGroup[]> = collectionData(
    query(collection(this.firestore, 'categoryGroups'), orderBy('createdAt', 'desc')),
    { idField: 'id' }
  ) as Observable<CategoryGroup[]>;

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

  // RED ================================================ CREATE CATEGORY ====================================
  async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'imageUrl'>, image?: File) {
    const { id, sequence } = await this.generateSequentialIdentifier('categories', 'CAT');

    const payload: Category = {
      ...category,
      createdAt: Timestamp.now(),
      sequence,
    };

    if (!payload.groupId) {
      delete payload.groupId;
    }

    if (image) {
      payload.imageUrl = await this.uploadFile(`categories/${this.createIdentifier()}`, image);
    }

    await setDoc(doc(this.firestore, 'categories', id), payload);
  }

  async updateCustomerOrders(
    orderIds: string[],
    changes: Partial<
      Pick<
        AdminOrder,
        'customerName' | 'customerEmail' | 'customerPhone' | 'shippingAddress' | 'restaurantName'
      >
    >
  ) {
    const updates = orderIds
      .filter((id): id is string => Boolean(id))
      .map((orderId) => updateDoc(doc(this.firestore, 'orders', orderId), changes));

    await Promise.all(updates);
  }

  async deleteCustomerOrders(orderIds: string[]) {
    const deletions = orderIds
      .filter((id): id is string => Boolean(id))
      .map((orderId) => deleteDoc(doc(this.firestore, 'orders', orderId)));

    await Promise.all(deletions);
  }

  async updateCategory(
    categoryId: string,
    changes: Partial<Omit<Category, 'id' | 'createdAt'>>,
    image?: File
  ) {
    const payload: Partial<Category> = { ...changes };

    if (!payload.groupId) {
      delete payload.groupId;
    }

    if (image) {
      payload.imageUrl = await this.uploadFile(`categories/${this.createIdentifier()}`, image);
    }

    await updateDoc(doc(this.firestore, 'categories', categoryId), payload);
  }

  // RED ================================================ CATEGORY GROUPS ====================================

  async createCategoryGroup(
    categoryGroup: Omit<CategoryGroup, 'id' | 'createdAt' | 'imageUrl'>,
    image?: File
  ) {
    const { id, sequence } = await this.generateSequentialIdentifier('categoryGroups', 'GRP');

    const payload: CategoryGroup = {
      ...categoryGroup,
      createdAt: Timestamp.now(),
      sequence,
    };

    if (image) {
      payload.imageUrl = await this.uploadFile(`category-groups/${this.createIdentifier()}`, image);
    }

    await setDoc(doc(this.firestore, 'categoryGroups', id), payload);
  }

  async updateCategoryGroup(
    categoryGroupId: string,
    changes: Partial<Omit<CategoryGroup, 'id' | 'createdAt'>>,
    image?: File
  ) {
    const payload: Partial<CategoryGroup> = { ...changes };

    if (image) {
      payload.imageUrl = await this.uploadFile(`category-groups/${this.createIdentifier()}`, image);
    }

    await updateDoc(doc(this.firestore, 'categoryGroups', categoryGroupId), payload);
  }

  async deleteCategoryGroup(categoryGroupId: string) {
    const relatedCategories = await getDocs(
      query(collection(this.firestore, 'categories'), where('groupId', '==', categoryGroupId))
    );

    const detachments = relatedCategories.docs.map((snapshot) =>
      updateDoc(snapshot.ref, { groupId: deleteField() })
    );

    const categoryGroupRef = doc(this.firestore, 'categoryGroups', categoryGroupId);
    const snapshot = await getDoc(categoryGroupRef);
    const imageUrl = snapshot.data()?.['imageUrl'];

    await Promise.all(detachments);

    if (typeof imageUrl === 'string' && imageUrl.trim().length) {
      await this.deleteFile(imageUrl);
    }

    await deleteDoc(categoryGroupRef);
  }

  async deleteCategory(categoryId: string) {
    const reference = doc(this.firestore, 'categories', categoryId);
    const snapshot = await getDoc(reference);
    const imageUrl = snapshot.data()?.['imageUrl'];

    if (typeof imageUrl === 'string' && imageUrl.trim().length) {
      await this.deleteFile(imageUrl);
    }

    await deleteDoc(reference);
  }

  // RED ================================================ CREATE SUBCATEGORY ====================================

  async createSubcategory(
    subcategory: Omit<Subcategory, 'id' | 'createdAt' | 'imageUrl'>,
    image?: File
  ) {
    const { id, sequence } = await this.generateSequentialIdentifier('subcategories', 'SUB');

    const payload: Subcategory = {
      ...subcategory,
      createdAt: Timestamp.now(),
      sequence,
    };

    if (image) {
      payload.imageUrl = await this.uploadFile(`subcategories/${this.createIdentifier()}`, image);
    }

    await setDoc(doc(this.firestore, 'subcategories', id), payload);
  }

  async updateSubcategory(
    subcategoryId: string,
    changes: Partial<Omit<Subcategory, 'id' | 'createdAt'>>,
    image?: File
  ) {
    const payload: Partial<Subcategory> = { ...changes };

    if (image) {
      payload.imageUrl = await this.uploadFile(`subcategories/${this.createIdentifier()}`, image);
    }

    await updateDoc(doc(this.firestore, 'subcategories', subcategoryId), payload);
  }

  async deleteSubcategory(subcategoryId: string) {
    const reference = doc(this.firestore, 'subcategories', subcategoryId);
    const snapshot = await getDoc(reference);
    const imageUrl = snapshot.data()?.['imageUrl'];

    if (typeof imageUrl === 'string' && imageUrl.trim().length) {
      await this.deleteFile(imageUrl);
    }

    await deleteDoc(reference);
  }

  // RED ================================================ CREATE PRODUCT ====================================
  async createProduct(
    product: Omit<Product, 'id' | 'createdAt' | 'mainImageUrl' | 'galleryUrls'>,
    mainImage?: File,
    galleryImages: File[] = []
  ) {
    const { id, sequence } = await this.generateSequentialIdentifier('products', 'PROD');

    const payload: Product = {
      ...product,
      createdAt: Timestamp.now(),
      sequence,
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

    await setDoc(doc(this.firestore, 'products', id), payload);
  }

  async deleteProduct(productId: string) {
    const reference = doc(this.firestore, 'products', productId);
    const snapshot = await getDoc(reference);
    const data = snapshot.data();
    const imageUrls: string[] = [];

    if (typeof data?.['mainImageUrl'] === 'string' && data['mainImageUrl'].trim().length) {
      imageUrls.push(data['mainImageUrl']);
    }

    if (Array.isArray(data?.['galleryUrls'])) {
      for (const url of data['galleryUrls']) {
        if (typeof url === 'string' && url.trim().length) {
          imageUrls.push(url);
        }
      }
    }

    await Promise.all(imageUrls.map((url) => this.deleteFile(url)));

    await deleteDoc(reference);
  }

  async updateProduct(
    productId: string,
    changes: Partial<Omit<Product, 'id' | 'createdAt'>>,
    mainImage?: File,
    galleryImages: File[] = [],
    existingGalleryUrls: string[] = []
  ) {
    const payload: Partial<Product> = { ...changes };

    if (mainImage) {
      payload.mainImageUrl = await this.uploadFile(
        `products/main/${this.createIdentifier()}`,
        mainImage
      );
    }

    const galleryUrls = [...existingGalleryUrls];

    if (galleryImages.length) {
      for (const image of galleryImages) {
        const url = await this.uploadFile(`products/gallery/${this.createIdentifier()}`, image);
        galleryUrls.push(url);
      }
    }

    payload.galleryUrls = galleryUrls;

    await updateDoc(doc(this.firestore, 'products', productId), payload);
  }

  // RED ================================================ CREATE ORDER ====================================

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

  async getContactInfo(): Promise<ContactInfo> {
    const reference = doc(this.firestore, 'settings', 'contact');
    const snapshot = await getDoc(reference);

    if (!snapshot.exists()) {
      return EMPTY_CONTACT_INFO;
    }

    const data = snapshot.data() as Partial<ContactInfo> | undefined;

    return {
      phone: data?.phone?.trim() ?? '',
      mobile: data?.mobile?.trim() ?? '',
      email: data?.email?.trim() ?? '',
      address: data?.address?.trim() ?? '',
      whatsappUrl: data?.whatsappUrl?.trim() ?? '',
      telegramUrl: data?.telegramUrl?.trim() ?? '',
      whatsappQrUrl: data?.whatsappQrUrl?.trim() ?? '',
    };
  }

  async updateContactInfo(
    info: Partial<ContactInfo>,
    options?: { whatsappQrFile?: File | null; removeWhatsappQr?: boolean }
  ) {
    const reference = doc(this.firestore, 'settings', 'contact');

    const payload: Partial<ContactInfo> = {
      phone: info.phone?.trim() ?? '',
      mobile: info.mobile?.trim() ?? '',
      email: info.email?.trim() ?? '',
      address: info.address?.trim() ?? '',
      whatsappUrl: info.whatsappUrl?.trim() ?? '',
      telegramUrl: info.telegramUrl?.trim() ?? '',
    };

    if (options?.whatsappQrFile) {
      payload.whatsappQrUrl = await this.uploadFile(
        `settings/contact/${this.createIdentifier()}`,
        options.whatsappQrFile
      );
    } else if (options?.removeWhatsappQr) {
      payload.whatsappQrUrl = '';
    }

    await setDoc(reference, payload, { merge: true });
  }

  private async generateSequentialIdentifier(
    collectionName: 'categories' | 'subcategories' | 'products' | 'categoryGroups',
    prefix: string
  ): Promise<{ id: string; sequence: number }> {
    const collectionRef = collection(this.firestore, collectionName);
    const latestDocQuery = query(collectionRef, orderBy('sequence', 'desc'), limit(1));
    const snapshot = await getDocs(latestDocQuery);
    const lastSequence = snapshot.empty ? 0 : Number(snapshot.docs[0].data()['sequence'] ?? 0) || 0;
    const sequence = lastSequence + 1;
    const id = `${prefix}-${sequence.toString().padStart(6, '0')}`;

    return { id, sequence };
  }

  private createIdentifier(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2);
  }

  // RED ================================================ UPLOAD IMAGE  ====================================
  private async uploadFile(path: string, file: File): Promise<string> {
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  private async deleteFile(url: string): Promise<void> {
    try {
      const storageRef = ref(this.storage, url);
      await deleteObject(storageRef);
    } catch (error) {
      console.warn('Failed to delete file from storage', error);
    }
  }
}
