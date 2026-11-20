import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "devbot",
    short_name: "devbot",
    description: "Your personal command center.",
    start_url: "/",
    display: "standalone",
    background_color: "#06070a",
    theme_color: "#06070a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
