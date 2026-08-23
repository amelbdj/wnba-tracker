export default function Logo({ size = 34 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="frontrow-mark" x1="10" y1="10" x2="80" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6d5bff" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#47bfff" />
        </linearGradient>
      </defs>
      <polygon points="25,10 90,10 78,32 13,32" fill="url(#frontrow-mark)" />
      <polygon points="13,32 30,32 24,92 7,92" fill="url(#frontrow-mark)" />
    </svg>
  );
}
