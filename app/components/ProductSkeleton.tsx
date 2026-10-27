export default function ProductSkeleton() {
  return <div className="product-skeleton" aria-hidden="true"><div className="skeleton-photo skeleton-shimmer" /><div className="skeleton-body"><div className="skeleton-line skeleton-shimmer" /><div className="skeleton-line short skeleton-shimmer" /><div className="skeleton-options skeleton-shimmer" /><div className="skeleton-cart skeleton-shimmer" /></div></div>;
}

export function ShopLoadingSkeleton() {
  return <div className="shop-loading section" role="status" aria-label="Loading products"><div className="skeleton-banner skeleton-shimmer" /><div className="product-grid shop-product-grid">{Array.from({ length: 8 }, (_, index) => <ProductSkeleton key={index} />)}</div><span className="sr-only">Loading the collection</span></div>;
}
