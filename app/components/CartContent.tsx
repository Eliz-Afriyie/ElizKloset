"use client";
import Skeleton from "./Skeleton";

import Link from "next/link";

import { formatPrice } from "../lib/catalog";
import { useShoppingStore } from "../lib/shopping-store";
import Photo from "./DesignPhoto";
import Icon from "./Icon";
import CheckoutDialog from "./CheckoutDialog";
import { useStoreCatalog } from "./StoreCatalog";

export default function CartContent() {
  const { products, loading, error } = useStoreCatalog();
  const { state, update } = useShoppingStore();
  const hidden = products.filter((product) => !product.inStock).map((product) => product.id);
  const unavailable = state.cart.some((line) => !products.find((product) => product.id === line.productId)?.variants.some((variant) => variant.color === line.color && variant.size === String(line.size) && variant.availableStock > 0));
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = state.cart.reduce((sum, line) => sum + (products.find((product) => product.id === line.productId)?.price ?? 0) * line.quantity, 0);
  function quantity(index: number, value: number) {
    update((previous) => ({ ...previous, cart: previous.cart.map((line, i) => i === index ? { ...line, quantity: Math.max(1, Math.min(99, value)) } : line) }));
  }
  if (loading) return <Skeleton variant="cart" label="Loading your bag" />;
  if (error) return null; // The shared catalog toast provides the error and Retry.
  if (!count) return <div className="empty-state"><Icon name="bag" /><h2>Your bag is waiting</h2><p>Find something you love and add it here.</p><Link className="button primary" href="/shop">Explore the collection</Link></div>;
  return <div className="bag-layout"><div className="bag-items-panel"><div className="bag-panel-heading"><h2>Your items <span>({count})</span></h2><Link href="/shop">Continue shopping <Icon name="arrow" /></Link></div>
    <div className="bag-items">{state.cart.map((line, index) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product) return <article className="bag-item" key={line.productId + index}><p>This style is no longer available.</p><button onClick={() => update((previous) => ({ ...previous, cart: previous.cart.filter((_, i) => i !== index) }))}>Remove unavailable item</button></article>;
      const image = product.colors.find((color) => color.name === line.color)?.image ?? product.image;
      return <article className="bag-item" key={`${line.productId}-${line.size}-${line.color}`}>
        <Link href={`/products/${product.id}`} className="bag-item-photo"><Photo src={image} alt={product.name} /></Link>
        <div className="bag-item-info"><p className="eyebrow">{product.category}</p><h3><Link href={`/products/${product.id}`}>{product.name}</Link></h3><p className="bag-item-variant">{line.color} · Size {line.size}</p>{hidden.includes(product.id) && <p className="admin-form-error">This style is currently unavailable. Remove it before checkout.</p>}<p className="bag-unit-price">{formatPrice(product.price)} each</p>
          <div className="bag-item-controls"><div className="quantity"><button disabled={line.quantity <= 1} aria-label={`Decrease quantity of ${product.name}`} onClick={() => quantity(index, line.quantity - 1)}>−</button><span aria-live="polite">{line.quantity}</span><button disabled={line.quantity >= 99} aria-label={`Increase quantity of ${product.name}`} onClick={() => quantity(index, line.quantity + 1)}>+</button></div><button className="bag-remove" aria-label={`Remove ${product.name} from bag`} onClick={() => update((previous) => ({ ...previous, cart: previous.cart.filter((_, i) => i !== index) }))}>Remove</button></div>
        </div><strong className="bag-line-total">{formatPrice(product.price * line.quantity)}</strong>
      </article>;
    })}</div><p className="bag-help"><Icon name="headset" />Need help with your selection? <Link href="/contact">Contact us</Link></p></div>
    <aside className="bag-summary"><p className="eyebrow">One step closer</p><h2>Order summary</h2><dl><div><dt>Subtotal ({count} {count === 1 ? "item" : "items"})</dt><dd>{formatPrice(subtotal)}</dd></div><div><dt>Delivery</dt><dd>To be confirmed</dd></div></dl><div className="bag-subtotal"><span>Items total</span><strong>{formatPrice(subtotal)}</strong></div><p className="bag-summary-note">Delivery charges will be confirmed before payment.</p><CheckoutDialog subtotal={subtotal} disabled={!count || unavailable} /><Link className="bag-continue" href="/shop">Continue shopping</Link><p className="bag-preview-note">Your bag is saved on this device. Online checkout is not available yet.</p></aside>
  </div>;
}


