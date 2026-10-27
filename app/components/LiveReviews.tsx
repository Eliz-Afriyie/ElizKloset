"use client";
import ErrorToast from "./ErrorToast";
import Skeleton from "./Skeleton";
import { useEffect, useState } from "react";
import { storeRequest } from "../lib/store-api";
type Review = { id: string; displayName: string; rating: number; title: string; body: string; verifiedPurchase: boolean };
export default function LiveReviews({ path, heading }: { path: string; heading: string }) {
  const [items, setItems] = useState<Review[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(async () => {
      setLoading(true); setError("");
      const response = await storeRequest<{ data: Review[] | { items: Review[] } }>(path, { signal: controller.signal });
      const reviews = Array.isArray(response.data) ? response.data : response.data?.items;
      if (!Array.isArray(reviews) || reviews.some((item) => typeof item.id !== "string" || typeof item.displayName !== "string" || !Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5 || typeof item.body !== "string")) throw new Error("The store returned unsupported reviews.");
      if (!controller.signal.aborted) setItems(reviews);
    }).catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load reviews."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision]);
  return <section className="reviews-section section"><div className="reviews-heading"><h2>{heading}</h2></div>{loading ? <Skeleton variant="reviews" label="Loading reviews" /> : error ? <ErrorToast message={error} onRetry={() => setRevision((value) => value + 1)} /> : !items.length ? <p>No published reviews yet.</p> : <div className="reviews-grid">{items.map((review) => <article className="review-card" key={review.id}><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div><h3>{review.title}</h3><blockquote>{review.body}</blockquote><div className="review-author"><strong>{review.displayName}</strong>{review.verifiedPurchase && <span>Verified purchase</span>}</div></article>)}</div>}</section>;
}
