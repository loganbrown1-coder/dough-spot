export function redirectUrl(): string {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return `${siteUrl.replace(/\/$/, "")}/auth/callback`;
}
