export interface ProductExtra {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  emoji: string;
  category: string;
  available: boolean;
  extras?: ProductExtra[];
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface BusinessSettings {
  name: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
  currency: string;
  orderingEnabled: boolean;
  businessOpen: boolean;
  businessHoursEnabled: boolean;
  schedule: Record<string, { enabled: boolean; open: string; close: string }>;
  businessTimezone: string;
  deliveryEnabled: boolean;
  deliveryFee: number;
  minOrderAmount: number;
  deliveryEtaMinutes: number;
  pickupEtaMinutes: number;
  pickupEnabled: boolean;
  deliveryNeighborhoods: string[];
  paymentMethods: { cash: boolean; transfer: boolean };
  transfer: { bank: string; holder: string; account: string };
}

export interface CatalogData {
  settings: BusinessSettings;
  categories: MenuCategory[];
  products: Product[];
}

export interface CartItem {
  lineId: string;
  product: Product;
  quantity: number;
  extras: ProductExtra[];
}

export type OrderType = "pickup" | "delivery";
export type PaymentMethod = "cash" | "transfer";

export interface CustomerAddress {
  street: string;
  neighborhood: string;
  reference?: string;
}

export interface OrderCustomer {
  name: string;
  phone?: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  address?: CustomerAddress;
  cashAmount?: number;
  notes?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  customer: OrderCustomer;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  status?: string;
}
