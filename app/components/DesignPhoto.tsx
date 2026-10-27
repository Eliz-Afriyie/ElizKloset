import Image from "next/image";

export default function DesignPhoto({ alt, className = "", src }: {
  alt: string;
  className?: string;
  src: string;
}) {
  if (!src) return <div className={`photo ${className}`} role="img" aria-label={alt || "No image available"}><span className="sr-only">No image available</span></div>;
  return (
    <div className={`photo ${className}`}>
      <Image src={src} alt={alt} fill unoptimized={/^https?:\/\//.test(src)} sizes="(max-width: 560px) 45vw, 25vw" className="dedicated-photo" />
    </div>
  );
}
