const TIKTOK_URL = "https://www.tiktok.com/@frontrow.women";

export default function TikTokLink({ className = "" }) {
  return (
    <a
      href={TIKTOK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`icon-btn ${className}`.trim()}
      aria-label="TikTok"
    >
      <i className="fa-brands fa-tiktok"></i>
    </a>
  );
}
