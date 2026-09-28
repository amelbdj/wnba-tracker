// TikTok error codes we have a specific, translated message for. Anything
// else falls back to a generic message plus the raw text TikTok returned,
// rather than pretending to explain an error we don't actually recognize.
const KNOWN_CODES = new Set([
  "not_connected",
  "access_token_invalid",
  "scope_not_authorized",
  "spam_risk_too_many_posts",
  "spam_risk_user_banned_from_posting",
  "reached_active_user_cap",
  "unaudited_client_can_only_post_to_private_accounts",
  "privacy_level_option_mismatch",
  "rate_limit_exceeded",
  "invalid_param",
]);

export function tiktokErrorKey(code) {
  return KNOWN_CODES.has(code) ? `tiktokErrors.${code}` : "tiktokErrors.generic";
}
