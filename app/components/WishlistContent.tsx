"use client";
import Skeleton from "./Skeleton";

import Link from "next/link";

import { useState } from "react";
import { formatPrice } from "../lib/catalog";
import { useShoppingStore } from "../lib/shopping-store";
import Photo from "./DesignPhoto";
import Icon from "./Icon";
import { useStoreCatalog } from "./StoreCatalog";
import { useCustomerSession } from "../lib/customer-session";

export default function WishlistContent() {
  const { products, loading, error } = useStoreCatalog();
  const { state, update } = useShoppingStore();
  const [notice, setNotice] = useState("");
  const { user, loading: checkingAccount, requireUser } = useCustomerSession();
  async function remove(id: string, name: string) {
    try {
      if (!await requireUser("Please sign in to update your saved styles.")) return;
      update((previous) => ({ ...previous, wishlist: previous.wishlist.filter((item) => item !== id) })); setNotice(name + " removed from your wishlist.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to verify your account."); }
  }
  const hidden = products.filter((product) => !product.inStock).map((product) => product.id);
  const saved = products.filter((product) => state.wishlist.includes(product.id) && !hidden.includes(product.id));
  if (loading || checkingAccount) return <Skeleton variant="cards" label="Loading your wishlist" />;
  if (!user) return <div className="wishlist-empty"><Icon name="heart" /><h2>Your favourites, kept for you.</h2><p>Sign in to save styles and view your wishlist.</p>{notice && <p role="alert">{notice}</p>}<button className="button primary" onClick={() => { void requireUser("Please sign in to view your saved styles.").catch((error) => setNotice(error instanceof Error ? error.message : "Unable to verify your account.")); }}>Sign in to view wishlist</button></div>;
  if (error) return null; // The shared catalog toast provides the error and Retry.
  if (!saved.length) return <div className="wishlist-empty"><span className="wishlist-empty-icon"><Icon name="heart" /></span><h2>A little inspiration, saved for later</h2><p>Tap the heart on any style to keep your favourites here.</p>{notice && <p role="status">{notice}</p>}<Link className="button primary" href="/shop">Explore the collection <Icon name="arrow" /></Link></div>;
  return <div className="wishlist-page-content"><div className="wishlist-toolbar"><div><p className="eyebrow">Your personal edit</p><p>{saved.length} saved {saved.length === 1 ? "style" : "styles"} · Choose your size when you’re ready.</p></div><Link href="/shop">Continue shopping <Icon name="arrow" /></Link></div>
    {notice && <p className="wishlist-notice" role="status">{notice}</p>}
    <div className="wishlist-grid">{saved.map((product) => <article className="wishlist-card" key={product.id}>
      <div className="wishlist-card-image"><Link href={`/products/${product.id}`} aria-label={`View ${product.name}`}><Photo src={product.image} alt={`${product.name} in ${product.color}`} /></Link><button className="wishlist-remove" aria-label={`Remove ${product.name} from wishlist`} onClick={() => void remove(product.id, product.name)}><Icon name="close" /></button></div>
      <div className="wishlist-card-body"><p className="eyebrow">{product.category}</p><h2><Link href={`/products/${product.id}`}>{product.name}</Link></h2><strong className="wishlist-price">{formatPrice(product.price)}</strong><p className="wishlist-color"><span style={{ backgroundColor: product.hex }} aria-hidden="true" />{product.color}{product.colors.length > 1 ? ` + ${product.colors.length - 1} colours` : ""}</p><Link className="button primary" href={`/products/${product.id}`}><Icon name="bag" />Choose size & colour</Link></div>
    </article>)}</div>
  </div>;
}


