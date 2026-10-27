export type ProductColor = { name: string; hex: string; image?: string };
export type Product = {
  id: string; apiId: string; slug: string; name: string; description: string; price: number; category: string;
  bestSeller: boolean; isNew: boolean; image: string; color: string; hex: string; colors: ProductColor[];
  availableSizes: (string | number)[]; inStock: boolean; addedOrder: number;
  variants: { id: string; size: string; color: string; availableStock: number }[];
};
export type CartLine = { productId: string; size: string | number; color: string; quantity: number };
export type ShoppingState = { cart: CartLine[]; wishlist: string[] };
export const formatPrice = (amount: number) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(amount);
// Browser storage contains identifiers and selections only; prices and stock come from the API.
export function readShoppingState(raw: string): ShoppingState {
  try {
    const data = JSON.parse(raw);
    const identifier = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 150;
    return {
      cart: Array.isArray(data.cart) ? data.cart.filter((line: CartLine) => line && identifier(line.productId) && (typeof line.size === "string" || typeof line.size === "number") && String(line.size).length <= 30 && identifier(line.color) && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99) : [],
      wishlist: Array.isArray(data.wishlist) ? [...new Set<string>(data.wishlist.filter(identifier))] : [],
    };
  } catch { return { cart: [], wishlist: [] }; }
}
