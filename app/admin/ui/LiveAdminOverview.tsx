"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "../../lib/catalog";
import Icon from "../../components/Icon";
import Photo from "../../components/DesignPhoto";
import { parseDashboard, type Dashboard } from "../lib/dashboard";
import { useAdminQuery } from "../lib/useAdminQuery";
import DateRangeFilter, { allDates, type DateRange } from "./DateRangeFilter";
import { OrderDetails } from "./AdminOrders";
import { useAdminSession } from "./AdminSession";
import { ApiStatus } from "./ApiControls";
import AdminSalesChart from "./AdminSalesChart";

function preset(days: number | null): DateRange {
  if (!days) return allDates;
  const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function DashboardContent({ data, range, onRange, onRefresh }: { data: Dashboard; range: DateRange; onRange: (value: DateRange) => void; onRefresh: () => void }) {
  const { staff } = useAdminSession();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [productIndex, setProductIndex] = useState(0);
  const product = data.topProducts.length ? data.topProducts[productIndex % data.topProducts.length] : null;
  const orders = data.recentOrders.filter((order) => (order.reference + " " + order.customer.name).toLowerCase().includes(search.trim().toLowerCase()));
  const count = (status: string) => data.orderStatuses.find((item) => item.status === status)?.count ?? 0;
  const cards = [
    { label: "Total products", value: data.stats.catalogStyles, detail: "Styles in your catalog", icon: "bag" },
    { label: "Completed orders", value: count("delivered"), detail: "Successfully delivered", icon: "truck" },
    { label: "Cancelled orders", value: count("cancelled"), detail: "Orders cancelled", icon: "close" },
    { label: "Paid orders", value: data.stats.paidOrders, detail: "Confirmed payments", icon: "card" },
  ] as const;
  return <>
    <div className="admin-overview-toolbar"><div><span className="admin-section-eyebrow">BUSINESS OVERVIEW</span><span>Keep an eye on the details that matter.</span></div><DateRangeFilter value={range} onChange={onRange} label="Overview date range" /></div>
    <div className="admin-stats">{cards.map((card) => <article className="admin-stat" key={card.label}><span className="admin-stat-icon"><Icon name={card.icon} /></span><div><p>{card.label}</p><strong>{card.value.toLocaleString()}</strong><small>{card.detail}</small></div></article>)}</div>
    <section className="admin-sales-report"><div className="admin-report-heading"><div><h2>Your sales report</h2><p>A closer look at your store performance</p></div><span className="admin-report-period">{range.from ? range.from + " to " + range.to : "All time"}</span></div><div className="admin-report-body"><div className="admin-report-summary"><span>Total paid revenue</span><strong>{formatPrice(data.stats.paidRevenue.amount / 100)}</strong><p><span className="admin-live-dot" />{data.stats.paidOrders} paid orders in this period</p><div className="admin-report-context"><span><strong>{data.stats.orders}</strong>Total orders</span><span><strong>{data.stats.stockAttention}</strong>Styles need stock</span></div><div className="admin-range-chips">{[{ label: "7D", days: 7 }, { label: "30D", days: 30 }, { label: "90D", days: 90 }, { label: "All time", days: null }].map((item) => { const value = preset(item.days); const active = value.from === range.from && value.to === range.to; return <button key={item.label} type="button" aria-pressed={active} className={active ? "selected" : ""} onClick={() => onRange(value)}>{item.label}</button>; })}</div></div><AdminSalesChart sales={data.sales} /></div></section>
    <div className="admin-reference-bottom">
      {staff?.permissions.includes("orders:read") ? <section className="admin-card admin-transactions"><div className="admin-card-heading"><div><h2>Latest orders</h2><p>Your most recent store activity</p></div><div className="admin-transaction-tools"><label><Icon name="search" /><input aria-label="Search latest orders" placeholder="Search orders..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><Link href="/admin/orders" aria-label="View and filter all orders" title="View all orders"><Icon name="menu" /></Link></div></div><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th><span className="admin-sr-only">Details</span></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.reference}</strong></td><td>{order.customer.name}</td><td>{order.createdAt?.slice(0, 10) ?? "-"}</td><td>{formatPrice(order.total.amount / 100)}</td><td><span className={"admin-order-pill " + (order.fulfilmentStatus === "delivered" ? "delivered" : order.fulfilmentStatus === "cancelled" ? "cancelled" : "processing")}>{order.fulfilmentStatus.replaceAll("_", " ")}</span></td><td><button className="admin-order-open" aria-label={"View order " + order.reference} onClick={() => setSelectedOrder(order.id)}><Icon name="arrow" /></button></td></tr>)}</tbody></table>{!orders.length && <div className="admin-dashboard-empty"><Icon name="bag" /><strong>{search ? "No matching orders" : "No orders in this period"}</strong><p>{search ? "Try another reference or customer name." : "New orders will appear here as your store grows."}</p></div>}</div>{!!orders.length && <Link href="/admin/orders" className="admin-view-all">View all orders <Icon name="arrow" /></Link>}</section> : <section className="admin-card admin-status-summary"><div className="admin-card-heading"><h2>Order overview</h2></div><dl className="admin-definition">{data.orderStatuses.map((item) => <div key={item.status}><dt>{item.status.replaceAll("_", " ")}</dt><dd>{item.count}</dd></div>)}</dl></section>}
      <aside className="admin-product-spotlight"><div className="admin-spotlight-heading"><span className="admin-section-eyebrow">CATALOG HIGHLIGHT</span><h2>{product ? "A customer favourite." : "Make room for your next favourite."}</h2><p>{product ? "A leading style from your store's paid orders." : "Your best-performing styles will appear here when sales begin."}</p></div><div className="admin-spotlight-image">{product?.image?.url ? <Photo src={product.image.url} alt={product.image.alt || product.name} /> : <div className="admin-spotlight-placeholder"><Icon name="bag" /><span>{product ? "Top-selling style" : "Your collection starts here"}</span></div>}{data.topProducts.length > 1 && <><button className="previous" type="button" aria-label="Previous top product" onClick={() => setProductIndex((index) => (index - 1 + data.topProducts.length) % data.topProducts.length)}><Icon name="chevron-left" /></button><button className="next" type="button" aria-label="Next top product" onClick={() => setProductIndex((index) => (index + 1) % data.topProducts.length)}><Icon name="chevron-right" /></button></>}</div><div className="admin-spotlight-caption">{product ? <><strong>{product.name}</strong><span>{product.unitsSold} sold ? {formatPrice(product.revenue.amount / 100)}</span></> : staff?.permissions.includes("catalog:write") ? <Link href="/admin/products/new" className="admin-button">Add a product <Icon name="plus" /></Link> : <span>No product sales in this period.</span>}</div></aside>
    </div>
    <details className="admin-sales-detail"><summary>View detailed sales history</summary><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Period</th><th>Paid orders</th><th>Revenue</th></tr></thead><tbody>{data.sales.map((item) => <tr key={item.date}><td>{item.date}</td><td>{item.paidOrders}</td><td>{formatPrice(item.revenue.amount / 100)}</td></tr>)}</tbody></table>{!data.sales.length && <p className="admin-empty">No sales history yet.</p>}</div></details>
    {selectedOrder && <OrderDetails id={selectedOrder} onClose={() => setSelectedOrder(null)} onSaved={onRefresh} />}
  </>;
}

export default function LiveAdminOverview() {
  const [range, setRange] = useState(allDates);
  const params = new URLSearchParams();
  if (range.from) params.set("createdFrom", range.from);
  if (range.to) params.set("createdTo", range.to);
  const query = useAdminQuery("dashboard?" + params, parseDashboard);
  return <><ApiStatus variant="dashboard" loading={query.loading} error={query.error} retry={query.refresh} />{query.data && !query.loading && <DashboardContent data={query.data} range={range} onRange={setRange} onRefresh={query.refresh} />}</>;
}
