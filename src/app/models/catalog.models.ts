export interface LocalizedText {
  ar: string;
  ru: string;
}

export interface Category {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  imageUrl: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: LocalizedText;
  description: LocalizedText;
  imageUrl: string;
}

export interface Product {
  id: string;
  categoryId: string;
  subcategoryId: string;
  name: LocalizedText;
  description: LocalizedText;
  price: number;
  color: string;
  images: string[];
  mainImageUrl: string;
  materials?: LocalizedText;
  features?: LocalizedText[];
}
