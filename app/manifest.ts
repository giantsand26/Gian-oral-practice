import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gian Oral Practice",
    short_name: "Gian Oral",
    description: "Your personal English speaking practice companion.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f0",
    theme_color: "#1b4838",
    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
