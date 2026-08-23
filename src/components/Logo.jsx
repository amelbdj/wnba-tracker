export default function Logo({ size = 34 }) {
  return (
    <svg
      width={size * 1.34}
      height={size}
      viewBox="0 0 134 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="frontrow-mark" x1="0" y1="0" x2="110" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2f5cf0" />
          <stop offset="1" stopColor="#7a3ae6" />
        </linearGradient>
      </defs>
      <polygon points="25,0 134,0 102,22 0,22" fill="url(#frontrow-mark)" />
      <polygon points="19,35 86,35 97,45 58,45 48,89 12,100" fill="url(#frontrow-mark)" />
    </svg>
  );
}
