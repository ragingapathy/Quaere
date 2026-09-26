import { registerAction } from "@/lib/actions/auth";
import { ErrorBanner } from "@/components/ErrorBanner";
import { STARTING_GRANT } from "@/lib/constants";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <section className="sheet">
      <h1>Register</h1>
      <p className="small muted">
        New accounts start with {STARTING_GRANT} cred to post a bounty or answer someone else's
        call.
      </p>
      <ErrorBanner message={searchParams.error} />
      <form action={registerAction}>
        <label className="field">
          <span>Email</span>
          <input type="email" name="email" required autoFocus />
        </label>
        <label className="field">
          <span>Username</span>
          <input type="text" name="username" required pattern="[a-zA-Z0-9_]{3,20}" />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" name="password" required minLength={8} />
        </label>
        <button className="btn" type="submit">
          Create account
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 12 }}>
        Already have an account? <a href="/login">Log in</a>.
      </p>
    </section>
  );
}
