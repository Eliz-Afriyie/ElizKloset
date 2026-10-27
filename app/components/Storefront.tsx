"use client";

import Link from "next/link";
import Skeleton from "./Skeleton";
import StoreCatalog, { useStoreCatalog } from "./StoreCatalog";
import CustomerSession from "./CustomerSession";
import { useCustomerSession } from "../lib/customer-session";
import { useRouter } from "next/navigation";
import Reviews from "./Reviews";

import ProductReviews from "./ProductReviews";
import AccountPanel from "./AccountPanel";
import CustomerAccountMenu from "./CustomerAccountMenu";
import Tooltip from "./Tooltip";
import ErrorToast from "./ErrorToast";
import SearchOverlay from "./SearchOverlay";
import CartContent from "./CartContent";
import OrdersContent from "./OrdersContent";
import WishlistContent from "./WishlistContent";
import AboutContent from "./AboutContent";
import ContactContent from "./ContactContent";
import { BrandExperience, MoreCollections, Newsletter } from "./BrandSections";

import SocialLinks from "./SocialLinks";
import Photo from "./DesignPhoto";
import Icon from "./Icon";
import HeroCarousel from "./HeroCarousel";
import ShopBrowser from "./ShopBrowser";
import { useEffect, useRef, useState } from "react";
import { formatPrice, type Product } from "../lib/catalog";
import { useShoppingStore } from "../lib/shopping-store";


function StorefrontContent({ isShop = false, isAbout = false, isContact = false, initialFilter = "All", initialQuery = "", commercePage, productId }: { commercePage?: "cart" | "wishlist" | "product" | "orders"; productId?: string; isShop?: boolean; isAbout?: boolean; isContact?: boolean; initialFilter?: string; initialQuery?: string }) {
  const router = useRouter();
  const { requireUser, user } = useCustomerSession();
  const { products, collections: apiCollections, loading: catalogLoading, error: catalogError, retry } = useStoreCatalog();
  const collections = apiCollections.map((item) => ({ name: item.name, description: item.description, filter: item.slug, image: item.image?.url ?? "" }));
  const hiddenProducts: string[] = [];
  const visibleProducts = products.filter((product) => !hiddenProducts.includes(product.id));
  const { state, update } = useShoppingStore();
  const [filter, setFilter] = useState(initialFilter);

  const query = initialQuery;

  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<"cart" | "wishlist" | "product" | "account" | "profile">("cart");
  const [quickProduct, setQuickProduct] = useState<Product | null>(null);
  const selectedProduct = quickProduct ?? products.find((product) => product.id === productId);
  function viewProduct(product: Product) { setQuickProduct(product); setPanel("product"); dialog.current?.showModal(); }
  const productUnavailable = !selectedProduct || hiddenProducts.includes(selectedProduct.id);
  const [notice, setNotice] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  useEffect(() => {
    if (!accountNotice) return;
    const timer = setTimeout(() => setAccountNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [accountNotice]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (panel === "profile" && !user) dialog.current?.close(); }, [panel, user]);
  const count = state.cart.reduce((total, line) => total + line.quantity, 0);
  const catalog = isShop ? visibleProducts : visibleProducts.slice(0, 5);
  const matchingProducts = catalog.filter((p) => (filter === "All" || (filter === "Best Sellers" ? p.bestSeller : p.category === filter)) && `${p.name} ${p.category} ${p.color}`.toLowerCase().includes(query.toLowerCase().trim()));

  const shownProducts = matchingProducts;
  function openPanel(next: typeof panel) { if (next === "cart" || next === "wishlist") { router.push(`/${next}`); return; } setPanel(next); dialog.current?.showModal(); }
  function shop(next: string) { if (!isShop) { router.push(`/shop?collection=${encodeURIComponent(next)}`); return; } setFilter(next); setMenuOpen(false); document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" }); }
  async function toggleWishlist(id: string) {
    try {
      if (!await requireUser("Please sign in to save this style to your wishlist.", () => update((previous) => ({ ...previous, wishlist: previous.wishlist.includes(id) ? previous.wishlist : [...previous.wishlist, id] })))) return;
      update((previous) => ({ ...previous, wishlist: previous.wishlist.includes(id) ? previous.wishlist.filter((item) => item !== id) : [...previous.wishlist, id] }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to verify your account. Please retry."); }
  }
  function addToCart(product: Product, size: string | number, color: string) {
    if (!product.variants.some((variant) => variant.size === String(size) && variant.color === color && variant.availableStock > 0)) { setNotice("This colour and size is currently unavailable."); return; }
    if (hiddenProducts.includes(product.id)) { setNotice("This style is currently unavailable."); return; }
    update((previous) => {
      const existing = previous.cart.find((line) => line.productId === product.id && line.size === size && line.color === color);
      return { ...previous, cart: existing ? previous.cart.map((line) => line === existing ? { ...line, quantity: Math.min(line.quantity + 1, 99) } : line) : [...previous.cart, { productId: product.id, size, color, quantity: 1 }] };
    });
    setNotice(`${product.name}, ${color}, size ${size}, added to your bag.`);
  }

  return <>
    <div className="announcement"><div className="announcement-inner"><span><Icon name="truck" /> Ghana-Wide Delivery</span><span><Icon name="lock" /> Secure Payments</span><span><Icon name="diamond" /> Quality Fashion</span><SocialLinks /></div></div>
    <header className="header">
      <Link href="/" className="logo" aria-label="ElizKloset home"><svg viewBox="0 0 75 58" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M36 19c0-6 7-6 7-12a5 5 0 0 0-10-1M36 19 7 36Q2 39 2 49M36 19l31 17q5 3 5 13" /><path d="M36 49 28 41c-7-9 4-14 8-7 5-7 16-2 8 7Z" /></svg><span><strong><b>Eliz</b>Kloset</strong><small>DRESS CORPORATE WITH LIZ</small></span></Link>
      <nav aria-label="Main navigation" className={menuOpen ? "navigation open" : "navigation"}><Link className={commercePage || isShop || isAbout || isContact ? "" : "active"} href="/" onClick={() => setMenuOpen(false)}>Home</Link><Link className={isShop ? "active" : ""} href="/shop" aria-label="Shop collections and new arrivals">Shop</Link><Link className={isAbout ? "active" : ""} href="/about" onClick={() => setMenuOpen(false)}>About Us</Link><Link className={isContact ? "active" : ""} href="/contact" onClick={() => setMenuOpen(false)}>Contact Us</Link></nav>
      <div className="header-actions"><SearchOverlay initialQuery={initialQuery} /><CustomerAccountMenu onOpen={() => setAccountNotice("")} onSignIn={() => openPanel("account")} onProfile={() => openPanel("profile")} /><Tooltip label="Your wishlist"><button className="icon-button" aria-label={`Wishlist, ${state.wishlist.length} items`} onClick={() => openPanel("wishlist")}><Icon name="heart" /><span className="badge">{state.wishlist.length}</span></button></Tooltip><Tooltip label="Your shopping bag"><button className="icon-button" aria-label={`Shopping bag, ${count} items`} onClick={() => openPanel("cart")}><Icon name="bag" /><span className="badge">{count}</span></button></Tooltip><Tooltip label="Open navigation"><button className="icon-button menu-button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button></Tooltip></div>
    </header>

    <main id="home" className={isContact ? "contact-page" : isAbout ? "about-page" : isShop ? "catalog-page" : "home-page"}>
      <ErrorToast message={catalogError} onRetry={retry} />
      {commercePage ? <section className="section commerce-page"><nav className="commerce-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link><span>/</span><span>{commercePage === "orders" ? "Your Orders" : commercePage === "cart" ? "Your Bag" : commercePage === "wishlist" ? "Wishlist" : productUnavailable ? "Product unavailable" : selectedProduct?.name ?? "Product"}</span></nav><h1>{commercePage === "orders" ? "Your Orders" : commercePage === "cart" ? "Your Bag" : commercePage === "wishlist" ? "Your Wishlist" : selectedProduct?.name ?? "Product"}</h1>{commercePage === "orders" && <OrdersContent />}{commercePage === "wishlist" && <WishlistContent />}{commercePage === "cart" && <CartContent />}{commercePage === "product" && catalogLoading && <Skeleton variant="detail" label="Loading product details" />}{commercePage === "product" && !catalogLoading && !catalogError && productUnavailable && <div className="empty-state"><h2>This style is currently unavailable</h2><p>Browse our other collections to find your next favourite.</p><Link className="button primary" href="/shop">Back to shop</Link></div>}{commercePage === "product" && selectedProduct && !productUnavailable && <ProductDetail key={selectedProduct.id} product={selectedProduct} saved={state.wishlist.includes(selectedProduct.id)} onSave={() => toggleWishlist(selectedProduct.id)} onAdd={(size, color) => addToCart(selectedProduct, size, color)} />}{commercePage !== "orders" && <section className="related-products"><div className="section-heading"><h2>You may also like</h2><Link href="/shop">Explore all styles</Link></div><div className="product-grid">{visibleProducts.filter((product) => product.id !== selectedProduct?.id && (commercePage !== "product" || product.category === selectedProduct?.category)).slice(0, 4).map((product) => <ProductCard key={product.id} product={product} saved={state.wishlist.includes(product.id)} onSave={() => toggleWishlist(product.id)} onAdd={(size, color) => addToCart(product, size, color)} onView={() => viewProduct(product)} />)}</div></section>}</section> : isContact ? <ContactContent /> : isAbout ? <AboutContent /> : <>
      {!isShop && <><HeroCarousel />
      <section id="collections" className="section collections"><div className="section-heading"><h2>Shop by Collection</h2><Link href="#shop" onClick={(event) => { event.preventDefault(); shop("All"); }}>View All <Icon name="arrow" /></Link></div>{catalogLoading && <Skeleton variant="cards" rows={4} label="Loading collections" />}<div className="collection-grid">{collections.map((collection) => <Link href="#shop" className="collection-card" key={collection.name} onClick={(event) => { event.preventDefault(); shop(collection.filter); }}><Photo src={collection.image} alt="" /><h3>{collection.name}</h3><p className="collection-description">{collection.description}</p><span className="round-arrow"><Icon name="arrow" /></span></Link>)}</div></section>
      <div className="section"><MoreCollections /></div>
      </>}
      {isShop ? <ShopBrowser initialCategory={initialFilter} initialQuery={initialQuery} renderProduct={(product) => <ProductCard key={product.id} product={product} saved={state.wishlist.includes(product.id)} onSave={() => toggleWishlist(product.id)} onAdd={(size, color) => addToCart(product, size, color)} onView={() => viewProduct(product)} />} /> :
      <section id="shop" className="section shop"><div className="section-heading shop-heading"><h2>{query ? "Search Results" : "New Arrivals"}</h2><Link className="view-all-button" href="/shop?collection=New%20Arrivals">View All<Icon name="arrow" /></Link></div>{catalogLoading && <Skeleton variant="cards" label="Loading new arrivals" />}<div className="product-grid">{!catalogLoading && shownProducts.map((product) => <ProductCard key={product.id} product={product} saved={state.wishlist.includes(product.id)} onSave={() => toggleWishlist(product.id)} onAdd={(size, color) => addToCart(product, size, color)} onView={() => viewProduct(product)} />)}</div>{!catalogLoading && !catalogError && shownProducts.length === 0 && <div className="empty-state"><h3>No styles found</h3><p>Try a different search or browse the full shop.</p><Link className="button outline" href="/shop">Explore all styles</Link></div>}</section>}
      {!isShop && <><BrandExperience /><Reviews /></>}
      </>}
      <section className="service-strip" aria-label="Shopping benefits"><div><Icon name="diamond" /><p><strong>Fresh New Arrivals</strong><span>Find your next favourite</span></p></div><div><Icon name="truck" /><p><strong>Ghana-Wide Delivery</strong><span>Made to reach you</span></p></div><div><Icon name="lock" /><p><strong>Secure Payments</strong><span>Mobile Money & Card</span></p></div><div><Icon name="headset" /><p><strong>Here for You</strong><span>Every step of the way</span></p></div><p className="closing-line">Style Today.<br />A Brighter Tomorrow.</p></section>
    </main>
    <Newsletter />
    <footer className="footer boutique-footer"><div className="footer-brand"><Link href="/" aria-label="ElizKloset home"><strong>Eliz<span>Kloset</span></strong><small>DRESS CORPORATE WITH LIZ</small></Link></div><nav aria-label="Footer navigation"><Link href="/">Home</Link><Link href="/shop">Collections &amp; New Arrivals</Link><Link href="/about">About Us</Link><Link href="/contact">Contact Us</Link></nav><SocialLinks showHandles /><div className="footer-bottom"><span>© ElizKloset. All rights reserved.</span><span>Corporate fashion, thoughtfully selected.</span></div></footer>
    {accountNotice && (accountNotice !== "You are signed in." || user) && <div className="customer-account-notice" role="status"><span>{accountNotice}</span><button type="button" className="icon-button" aria-label="Dismiss account message" onClick={() => setAccountNotice("")}><Icon name="close" /></button></div>}
    {notice && <div className="toast" role="status"><Icon name="bag" /><span>{notice}</span><button onClick={() => { setNotice(""); openPanel("cart"); }}>View bag</button><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice("")}><Icon name="close" /></button></div>}
    <dialog aria-labelledby="shopping-dialog-title" ref={dialog} onClose={() => { if (panel === "account" || panel === "profile") { setPanel("cart"); document.querySelector<HTMLButtonElement>(".customer-account-button")?.focus(); } }} className={`shopping-dialog ${panel === "product" ? "detail-dialog" : ""}`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}><div className="dialog-header"><h2 id="shopping-dialog-title">{panel === "cart" ? `Your Bag (${count})` : panel === "wishlist" ? "Your Wishlist" : panel === "profile" ? "Your profile" : panel === "account" ? "Your Account" : "A closer look"}</h2><button className="icon-button" aria-label="Close dialog" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      {(panel === "account" || panel === "profile") && <AccountPanel onSignedIn={() => { dialog.current?.close(); setAccountNotice("You are signed in."); }} onSaved={() => { dialog.current?.close(); setAccountNotice("Your profile was saved."); }} />}
      {panel === "product" && selectedProduct && <ProductDetail key={selectedProduct.id} product={selectedProduct} saved={state.wishlist.includes(selectedProduct.id)} onSave={() => toggleWishlist(selectedProduct.id)} onAdd={(size, color) => addToCart(selectedProduct, size, color)} />}

    </dialog>
  </>;
}

function ProductOptions({ product, onAdd, selectedColor, onColorChange }: { product: Product; onAdd: (size: string | number, color: string) => void; selectedColor?: string; onColorChange?: (color: string) => void }) {
  const [size, setSize] = useState<string | number | null>(null);
  const [localColor, setLocalColor] = useState(product.color);
  const [error, setError] = useState(false);
  const color = selectedColor ?? localColor;
  return <div className="product-options"><div className="colour-choice" role="group" aria-label={`Colour for ${product.name}`}>{product.colors.map((option) => <button key={option.name} type="button" className={`swatch color-swatch ${color === option.name ? "selected-color" : ""}`} style={{ backgroundColor: option.hex }} aria-label={`${product.name}: ${option.name}`} title={option.name} aria-pressed={color === option.name} onClick={() => { setLocalColor(option.name); onColorChange?.(option.name); }} />)}<span className="selected-color-name">{color}</span></div>{!product.colors.find((option) => option.name === color)?.image && <p className="variant-photo-note">Shown in {product.color}</p>}<div className="size-options" role="group" aria-label={`Size for ${product.name}`}>{product.availableSizes.map((value) => <button key={value} disabled={!product.variants.some((variant) => variant.size === String(value) && variant.color === color && variant.availableStock > 0)} aria-pressed={size === value} className={size === value ? "chosen" : ""} onClick={() => { setSize(value); setError(false); }}>{value}</button>)}</div>{error && <p className="size-error" role="alert">Please choose your size.</p>}<button className="add-button" disabled={!product.inStock || !product.variants.some((variant) => variant.color === color && variant.availableStock > 0)} onClick={() => { if (size === null) { setError(true); return; } onAdd(size, color); }}><Icon name="bag" />Add to Cart</button></div>;
}
function ProductCard({ product, saved, onSave, onAdd, onView }: { product: Product; saved: boolean; onSave: () => void; onAdd: (size: string | number, color: string) => void; onView: () => void }) {
  const [selectedColor, setSelectedColor] = useState(product.color);
  const photo = product.colors.find((color) => color.name === selectedColor)?.image ?? product.image;
  return (
    <article className="product-card">
      <div className="product-image">
        <button className="photo-button" onClick={onView} aria-label={`View ${product.name}`}>
          <Photo src={photo} alt={`${product.name} in ${product.color}`} />
        </button>
        {(product.bestSeller || product.isNew) && <span className={`product-badge ${product.bestSeller ? "bestseller" : "new"}`}>{product.bestSeller ? "Bestseller" : "New"}</span>}
        <button className={`save-button ${saved ? "saved" : ""}`} aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} wishlist`} aria-pressed={saved} onClick={onSave}><Icon name="heart" /></button>
      </div>
      <div className="product-body">
        <h3><button onClick={onView}>{product.name}</button></h3>
        <p className="price">{formatPrice(product.price)}</p>
        <ProductOptions product={product} onAdd={onAdd} selectedColor={selectedColor} onColorChange={setSelectedColor} />
      </div>
    </article>
  );
}













function ProductDetail({ product, saved, onSave, onAdd }: { product: Product; saved: boolean; onSave: () => void; onAdd: (size: string | number, color: string) => void }) {
  const [color, setColor] = useState(product.color);
  const image = product.colors.find((option) => option.name === color)?.image ?? product.image;
  const picturedColor = product.colors.find((option) => option.image === image)?.name ?? product.color;
  return <div className="product-detail"><Photo className="detail-photo" src={image} alt={product.name + " shown in " + picturedColor} /><div><p className="eyebrow">{product.category}</p><h3>{product.name}</h3><p className="detail-price">{formatPrice(product.price)}</p><p>{product.description}</p>
    <dl className="detail-facts"><div><dt>Style reference</dt><dd>{product.id}</dd></div><div><dt>Selected colour</dt><dd>{color}</dd></div></dl>
    <p className="muted">Choose an available colour and size below.</p>
    <ProductOptions product={product} selectedColor={color} onColorChange={setColor} onAdd={onAdd} />
    <button className="text-button" type="button" aria-pressed={saved} onClick={onSave}><Icon name="heart" />{saved ? "Remove from wishlist" : "Save to wishlist"}</button>
    <details className="detail-info"><summary>Fit and care</summary><p>Fabric composition, measurements and care instructions will be added for this style. Contact us for help choosing your size.</p></details>
    <details className="detail-info"><summary>Delivery and returns</summary><p>Ghana-wide delivery. Delivery charges, estimated dates and the returns policy will be confirmed before checkout is available.</p></details>
    <Link className="text-button" href="/contact">Ask about this style <Icon name="arrow" /></Link>
  </div><ProductReviews key={product.id} productId={product.apiId} productName={product.name} /></div>;
}

export default function Storefront(props: Parameters<typeof StorefrontContent>[0]) { return <CustomerSession><StoreCatalog slug={props.productId}><StorefrontContent {...props} /></StoreCatalog></CustomerSession>; }


