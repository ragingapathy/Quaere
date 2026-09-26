import { loginAction } from "@/lib/actions/auth";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <section className="sheet">
      <h1>Log in</h1>
      <ErrorBanner message={searchParams.error} />
      <form action={loginAction}>
        <label className="field">
          <span>Email</span>
          <input type="email" name="email" required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" name="password" required />
        </label>
        <button className="btn" type="submit">
          Log in
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 12 }}>
        New here? <a href="/register">Register an account</a>.
      </p>
    </section>
  );
}
