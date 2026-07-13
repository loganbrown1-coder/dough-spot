export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Dough Spot"
    >
      <rect width="40" height="40" rx="10" fill="#0A6BFF" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="white" strokeWidth="5" />
    </svg>
  );
}
