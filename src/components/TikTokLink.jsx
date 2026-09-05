// No TikTok account URL yet — points at the Instagram profile in the
// meantime. Swap TIKTOK_URL once a real TikTok link is available.
const TIKTOK_URL = "https://www.instagram.com/frontrow.sport/";

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
