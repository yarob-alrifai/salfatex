export interface Category {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface Product {
  id: string;
  categoryId: string;
  subcategoryId: string;
  name: string;
  description: string;
  price: number;
  color: string;
  mainImageUrl?: string;
  galleryUrls?: string[];
  materials?: string;
  features?: string[];
  sequence?: number;
}
