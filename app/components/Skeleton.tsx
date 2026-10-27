import ProductSkeleton from "./ProductSkeleton";

export type SkeletonVariant = "cards" | "table" | "form" | "detail" | "dashboard" | "cart" | "reviews" | "store" | "workspace";
function Bar({ className = "" }: { className?: string }) { return <div className={`ek-skeleton-block ek-skeleton-bar ${className}`} />; }
function Lines() { return <><Bar /><Bar className="medium" /><Bar className="short" /></>; }
function Form() { return <div className="ek-skeleton-form"><Bar className="medium" />{[0, 1, 2].map((item) => <div key={item}><Bar className="short" /><div className="ek-skeleton-block ek-skeleton-input" /></div>)}<div className="ek-skeleton-block ek-skeleton-action" /></div>; }
function Table({ rows }: { rows: number }) { return <div className="ek-skeleton-table"><div className="ek-skeleton-toolbar"><Bar className="medium" /><div className="ek-skeleton-block ek-skeleton-action" /></div>{Array.from({ length: rows }, (_, index) => <div className="ek-skeleton-row" key={index}><div className="ek-skeleton-block ek-skeleton-avatar" /><Bar /><Bar /><Bar className="short" /></div>)}</div>; }
function Dashboard() { return <><div className="ek-skeleton-metrics">{[0, 1, 2, 3].map((item) => <div className="ek-skeleton-panel" key={item}><Lines /></div>)}</div><div className="ek-skeleton-panel"><Bar className="medium" /><div className="ek-skeleton-block ek-skeleton-chart" /></div><Table rows={4} /></>; }
function Detail() { return <div className="ek-skeleton-detail"><div className="ek-skeleton-block ek-skeleton-detail-photo" /><Form /></div>; }
function Cards({ rows }: { rows: number }) { return <div className="product-grid shop-product-grid">{Array.from({ length: rows }, (_, index) => <ProductSkeleton key={index} />)}</div>; }

export default function Skeleton({ variant = "table", rows = 4, label = "Loading content", className = "" }: { variant?: SkeletonVariant; rows?: number; label?: string; className?: string }) {
  const screen = variant === "store" || variant === "workspace";
  return <div className={`ek-skeleton ek-skeleton-${variant} ${screen ? "ek-skeleton-screen" : ""} ${className}`} role="status" aria-busy="true" aria-label={label}>
    <span className="ek-skeleton-announcement">{label}</span>
    <div aria-hidden="true">
      {variant === "cards" ? <Cards rows={rows} /> : variant === "form" ? <Form /> : variant === "detail" ? <Detail /> : variant === "dashboard" ? <Dashboard /> : variant === "reviews" ? <div className="ek-skeleton-reviews">{[0, 1, 2].map((item) => <div className="ek-skeleton-panel" key={item}><Lines /><Lines /></div>)}</div> : variant === "cart" ? <div className="ek-skeleton-cart-layout"><div>{[0, 1, 2].map((item) => <div className="ek-skeleton-cart-item" key={item}><div className="ek-skeleton-block ek-skeleton-thumbnail" /><div><Lines /><Bar /></div></div>)}</div><div className="ek-skeleton-panel"><Lines /><Lines /><div className="ek-skeleton-block ek-skeleton-action" /></div></div> : variant === "store" ? <><div className="ek-skeleton-toolbar"><Bar className="medium" /><Bar className="short" /></div><div className="ek-skeleton-block ek-skeleton-banner" /><Cards rows={rows} /></> : variant === "workspace" ? <div className="ek-skeleton-workspace-layout"><div className="ek-skeleton-sidebar"><Lines /><Lines /><Lines /></div><div className="ek-skeleton-workspace-main"><Bar className="medium" /><Dashboard /></div></div> : <Table rows={rows} />}
    </div>
  </div>;
}
