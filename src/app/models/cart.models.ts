import { Product, ProductUnitType } from './catalog.models';

export interface CartUnitSelection {
  type: ProductUnitType;
  price: number;
  label: string;
  piecesCount?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit: CartUnitSelection;
}

export interface CartSnapshot {
  items: CartItem[];
  total: number;
}

export interface CustomerInfo {
  name: string;
  email: string;
  restaurantName: string;
  phone: string;

  address: string;
  notes?: string;
}
