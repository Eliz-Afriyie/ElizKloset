import { unwrap } from "./api";
import { isObject, type Money } from "./resources";

export type Dashboard = {
  stats: { paidRevenue: Money; paidOrders: number; orders: number; catalogStyles: number; stockAttention: number };
  sales: { date: string; revenue: Money; paidOrders: number }[];
  orderStatuses: { status: string; count: number }[];
  topProducts: { productId: string; name: string; unitsSold: number; revenue: Money; image?: { url: string; alt: string } | null }[];
  recentOrders: { id: string; reference: string; customer: { name: string }; total: Money; fulfilmentStatus: string; createdAt?: string }[];
};
export function parseDashboard(response: unknown): Dashboard {
  const value = unwrap(response);
  if (!isObject(value) || !isObject(value.stats) || !isObject(value.stats.paidRevenue) || !Number.isInteger(value.stats.paidRevenue.amount) || !["paidOrders", "orders", "catalogStyles", "stockAttention"].every((key) => Number.isInteger((value.stats as Record<string, unknown>)[key])) || !Array.isArray(value.sales) || !Array.isArray(value.orderStatuses) || !Array.isArray(value.topProducts) || !Array.isArray(value.recentOrders)) throw new Error("Unsupported dashboard response from the API.");
  if (value.sales.some((item) => !isObject(item) || typeof item.date !== "string" || !isObject(item.revenue) || !Number.isInteger(item.revenue.amount) || !Number.isInteger(item.paidOrders))) throw new Error("Unsupported sales history from the API.");
  return value as Dashboard;
}
