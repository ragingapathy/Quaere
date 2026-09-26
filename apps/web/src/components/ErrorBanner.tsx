export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="status error">{message}</p>;
}
