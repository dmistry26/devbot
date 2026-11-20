import { ImageResponse } from "next/og";

// Home-screen icon for iPhone/iPad ("Add to Home Screen").
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#06070a" }}>
        <svg width="120" height="120" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f6e2b8" />
              <stop offset="0.55" stopColor="#e9c27d" />
              <stop offset="1" stopColor="#8fc2ff" />
            </linearGradient>
          </defs>
          <rect x="18" y="18" width="28" height="28" rx="7" transform="rotate(45 32 32)" fill="none" stroke="url(#g)" strokeWidth="2.6" />
          <circle cx="32" cy="32" r="5" fill="url(#g)" />
        </svg>
      </div>
    ),
    size,
  );
}
