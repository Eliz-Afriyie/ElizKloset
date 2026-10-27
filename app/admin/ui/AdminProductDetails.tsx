"use client";
import Skeleton from "../../components/Skeleton";

import Photo from "../../components/DesignPhoto";
import { formatPrice } from "../../lib/catalog";
import type { AdminProduct, Taxonomy } from "./AdminCatalog";
import ConfirmDelete from "./ConfirmDelete";

export default function AdminProductDetails({ product, onEdit, onClose, canWrite, taxonomy, onToggle, onDelete }: {
  product?: AdminProduct; onEdit: (product: AdminProduct) => void; onClose: () => void;
  canWrite: boolean; taxonomy: Taxonomy[]; onToggle: (product: AdminProduct) => void; onDelete: (product: AdminProduct) => void;
}) {
  if (!product) return <section className="admin-card admin-product-detail"><h2>Product details</h2><Skeleton variant="detail" label="Loading product details" /><button className="admin-button" onClick={onClose}>Back to products</button></section>;
  const active = product.status === "active";
  return <section className="admin-card admin-product-detail"><div className="admin-product-detail-heading"><div><p className="admin-small-label">PRODUCT DETAILS</p><h2>{product.name}</h2><span className={"admin-status " + (active ? "green" : "amber")}>{active ? "Active" : product.status === "draft" ? "Draft" : "Inactive"}</span></div>{canWrite && <div className="admin-row-actions"><button className="admin-button secondary" onClick={() => onEdit(product)}>Edit product</button><ConfirmDelete name={product.name} description="Delete this product from the store? Historical orders are retained." onDelete={() => onDelete(product)} /></div>}</div>
    <div className="admin-product-detail-grid">{product.image && <Photo src={product.image} alt={product.name} />}<div><strong className="admin-product-detail-price">{formatPrice(product.price)}</strong><p>{product.description || "No description added yet."}</p><dl className="admin-definition"><div><dt>Category</dt><dd>{taxonomy.find((item) => item.id === product.categoryId)?.name ?? "Unassigned"}</dd></div><div><dt>Collections</dt><dd>{product.collectionIds.map((id) => taxonomy.find((item) => item.id === id)?.name).filter(Boolean).join(", ") || "None"}</dd></div><div><dt>Available stock</dt><dd>{product.stock} units</dd></div><div><dt>Colour variants</dt><dd>{product.colors.join(", ")}</dd></div></dl><div className="admin-visibility-control"><h3>Storefront visibility</h3><p>{active ? "Deactivate to remove this style from the public API catalog." : "Activate to make this style available in the public API catalog."}</p><button className={"admin-button " + (active ? "secondary" : "")} disabled={!canWrite} onClick={() => onToggle(product)}>{active ? "Deactivate product" : "Activate product"}</button></div></div></div>
    <h3>Colours & size inventory</h3><div className="admin-detail-variants">{product.variants.map((variant) => <article key={variant.id}>{variant.image ? <Photo src={variant.image} alt={product.name + " in " + variant.color} /> : <p>No photo assigned</p>}<strong><span style={{ background: variant.hex }} />{variant.color}</strong><p>{variant.sizes.map((size) => size.size + ": " + size.stock).join(" / ")}</p></article>)}</div>
  </section>;
}
