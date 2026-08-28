const INSTAGRAM_URL = "https://www.instagram.com/frontrow.sport/";

export default function InstagramLink({ className = "" }) {
  return (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`icon-btn ${className}`.trim()}
      aria-label="Instagram"
    >
      <i className="fa-brands fa-instagram"></i>
    </a>
  );
}
