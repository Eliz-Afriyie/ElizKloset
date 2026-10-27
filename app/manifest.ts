import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ElizKloset - Corporate Fashion",
    short_name: "ElizKloset",
    description: "Elegant corporate wear for women in Ghana.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFF9F3",
    theme_color: "#750D27",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
