export type Review = {
  id: string;
  rating: number;
  comment: string;
  reviewerName: string;
  date: string;
  verified: boolean;
};

export type Product = {
  id: string;
  title: string;
  brand: string;
  category: string;
  description: string;
  /** INR, integer */
  price: number;
  /** INR, integer */
  mrp: number;
  rating: number;
  reviewCount: number;
  images: string[];
  thumbnail: string;
  specs: Record<string, string>;
  stock: number;
  tags: string[];
  sponsored?: boolean;
  reviews: Review[];
};

export type Category = {
  slug: string;
  name: string;
  count: number;
  /** Average / best discount across the category, in percent. */
  avgDiscount?: number;
  maxDiscount?: number;
  image?: string;
};

export type CartItem = { productId: string; qty: number; priceAtAdd: number };

export type OrderStatus = 'placed' | 'shipped' | 'delivered';

export type Address = { name: string; phone: string; line1: string; city: string; pincode: string };

export type OrderItem = {
  productId: string;
  title: string;
  qty: number;
  price: number;
  /** Optional so orders render with thumbnails without refetching products. */
  thumbnail?: string;
};

export type OrderStatusEvent = { status: OrderStatus; at: string };

export type Order = {
  id: string;
  items: OrderItem[];
  subtotal: number;
  delivery: number;
  total: number;
  address: Address;
  status: OrderStatus;
  createdAt: string;
  /** When each status was reached, oldest first. */
  history?: OrderStatusEvent[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  grounded?: boolean;
  citations?: string[];
};

export type Insight = { point: string; reviewIds: string[] };

export type BuyerInsights = { pros: Insight[]; cons: Insight[] };

export type ProductSort = 'relevance' | 'price_asc' | 'price_desc' | 'rating';

export type ProductQuery = {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: ProductSort;
  /** Only sponsored listings (Home's clearly labelled Sponsored row). */
  sponsored?: boolean;
  page?: number;
  limit?: number;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

/** Filters a natural-language query can produce (subset of ProductQuery). */
export type SearchFilters = Omit<ProductQuery, 'page' | 'limit' | 'sponsored'>;

export type ParsedSearch = { filters: SearchFilters; explanation: string };

export type AskResponse = { answer: string; grounded: boolean; citations: string[] };

export type AlertType = 'price_drop' | 'back_in_stock';

export type CreateOrderInput = {
  deviceId: string;
  items: OrderItem[];
  address: Address;
};
