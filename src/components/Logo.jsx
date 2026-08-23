export default function Logo({ size = 34 }) {
  return (
    <img
      src="/logo-mark.svg"
      alt=""
      width={size * 1.0857}
      height={size}
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    />
  );
}
