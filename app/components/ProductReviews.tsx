import LiveReviews from "./LiveReviews";
export default function ProductReviews({ productId, productName }: { productId: string; productName: string }) { return <LiveReviews path={`products/${encodeURIComponent(productId)}/reviews`} heading={`Reviews for ${productName}`} />; }
