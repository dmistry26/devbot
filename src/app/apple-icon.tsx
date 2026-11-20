import { ImageResponse } from "next/og";

// Home-screen icon for iPhone/iPad ("Add to Home Screen").
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#06070a" }}>
        <svg width="132" height="132" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
              <stop offset="0" stopColor="#f6e2b8" />
              <stop offset="0.55" stopColor="#e9c27d" />
              <stop offset="1" stopColor="#8fc2ff" />
            </linearGradient>
          </defs>
          {[0, 72, 144, 216, 288].map((deg) => (
            <path
              key={deg}
              d="M12 11.2C9.6 8.9 9.7 4.6 12 2.9C14.3 4.6 14.4 8.9 12 11.2Z"
              transform={`rotate(${deg} 12 12)`}
              fill="url(#g)"
              fillOpacity="0.16"
              stroke="url(#g)"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          ))}
          <circle cx="12" cy="12" r="2.4" fill="url(#g)" />
        </svg>
      </div>
    ),
    size,
  );
}
