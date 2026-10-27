"use client";

import { useId, useState } from "react";
import { formatPrice } from "../../lib/catalog";
import type { Dashboard } from "../lib/dashboard";

export default function AdminSalesChart({ sales }: { sales: Dashboard["sales"] }) {
  const id = useId().replaceAll(":", "");
  const [active, setActive] = useState<number | null>(null);
  const width = 820, height = 230, left = 12, right = 12, top = 28, bottom = 30;
  const maxRevenue = Math.max(1, ...sales.map((item) => item.revenue.amount));
  const maxOrders = Math.max(1, ...sales.map((item) => item.paidOrders));
  const x = (index: number) => sales.length === 1 ? width / 2 : left + index / (sales.length - 1) * (width - left - right);
  const y = (value: number, max: number) => top + (1 - value / max) * (height - top - bottom);
  const path = (metric: "revenue" | "orders") => sales.map((item, index) => `${index ? "L" : "M"}${x(index)},${y(metric === "revenue" ? item.revenue.amount : item.paidOrders, metric === "revenue" ? maxRevenue : maxOrders)}`).join(" ");
  const revenuePath = path("revenue");
  const selectedIndex = active === null ? null : Math.min(active, sales.length - 1);
  const selected = selectedIndex === null ? null : sales[selectedIndex];
  const labelIndexes = [...new Set([0, Math.floor((sales.length - 1) / 4), Math.floor((sales.length - 1) / 2), Math.floor((sales.length - 1) * .75), sales.length - 1])];
  if (!sales.length) return <div className="admin-chart-empty"><strong>No sales in this period</strong><p>Your sales report will appear here when orders are recorded.</p></div>;
  return <div className="admin-line-chart"><div className="admin-chart-legend"><span><i />Revenue</span><span><i />Paid orders</span></div>
    <div className="admin-chart-axis-labels"><span>{formatPrice(maxRevenue === 1 && sales.every((item) => !item.revenue.amount) ? 0 : maxRevenue / 100)}</span><span>{maxOrders === 1 && sales.every((item) => !item.paidOrders) ? 0 : maxOrders} orders</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales report: burgundy revenue on the left scale, gold paid orders on the right scale. Use left and right arrow keys to inspect periods." tabIndex={0} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const position = (event.clientX - rect.left) / rect.width * width; setActive(Math.max(0, Math.min(sales.length - 1, Math.round((position - left) / (width - left - right) * (sales.length - 1))))); }} onPointerLeave={() => setActive(null)} onFocus={() => setActive(sales.length - 1)} onBlur={() => setActive(null)} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); setActive((previous) => event.key === "Home" ? 0 : event.key === "End" ? sales.length - 1 : Math.max(0, Math.min(sales.length - 1, (previous ?? sales.length - 1) + (event.key === "ArrowRight" ? 1 : -1)))); } }}>
      <defs><linearGradient id={`sales-fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#750d27" stopOpacity=".13" /><stop offset="100%" stopColor="#750d27" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map((line) => <line key={line} x1={left} x2={width - right} y1={top + line / 3 * (height - top - bottom)} y2={top + line / 3 * (height - top - bottom)} className="admin-chart-gridline" />)}
      {sales.length > 1 && <path d={`${revenuePath} L${x(sales.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z`} fill={`url(#sales-fill-${id})`} />}
      <path d={revenuePath} className="admin-chart-revenue" /><path d={path("orders")} className="admin-chart-orders" />
      {sales.length === 1 && <><circle cx={x(0)} cy={y(sales[0].revenue.amount, maxRevenue)} r="4" fill="#750d27" /><circle cx={x(0)} cy={y(sales[0].paidOrders, maxOrders)} r="4" fill="#bc935e" /></>}
      {selected && selectedIndex !== null && <><line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={top} y2={height - bottom} className="admin-chart-crosshair" /><circle cx={x(selectedIndex)} cy={y(selected.revenue.amount, maxRevenue)} r="5" fill="#750d27" stroke="#fff" strokeWidth="2" /></>}
      {labelIndexes.map((index) => <text key={index} x={x(index)} y={height - 6} textAnchor={index === 0 ? "start" : index === sales.length - 1 ? "end" : "middle"}>{new Date(`${sales[index].date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</text>)}
    </svg>
    <div className="admin-chart-readout" role="status" aria-live="polite">{selected ? <><strong>{selected.date}</strong><span>{formatPrice(selected.revenue.amount / 100)}</span><span>{selected.paidOrders} paid orders</span></> : <span>Hover or focus the chart to explore sales.</span>}</div>
  </div>;
}
