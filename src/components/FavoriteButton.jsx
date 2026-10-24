import { useTranslation } from "react-i18next";
import { useFavorites } from "../utils/favorites";

// The star that adds a team to "My teams". `variant="pill"` shows a label
// (team page); the default is an icon for cards.
export default function FavoriteButton({ league, team, variant = "icon", className = "" }) {
  const { t } = useTranslation();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(league, team.id);
  const label = t(active ? "favorites.remove" : "favorites.add");

  return (
    <button
      type="button"
      className={`fav-btn fav-btn-${variant}${active ? " is-active" : ""} ${className}`.trim()}
      aria-pressed={active}
      aria-label={variant === "icon" ? label : undefined}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(league, team);
      }}
    >
      <i className={`${active ? "fa-solid" : "fa-regular"} fa-star`}></i>
      {variant === "pill" && <span>{t(active ? "favorites.following" : "favorites.follow")}</span>}
    </button>
  );
}
