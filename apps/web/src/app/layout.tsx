import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quaere — a court for claims",
  description: "A patron funds a bounty. A claimant stakes a claim. The audience decides.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap top-row">
            <a href="/bounties" className="wordmark" style={{ fontSize: 24, textDecoration: "none" }}>
              Quaere
            </a>
            <nav className="nav-links">
              <a href="/bounties">Bounty board</a>
              {user ? (
                <>
                  <span className="muted">
                    {user.username} · {user.balance} cred
                  </span>
                  <form action={logoutAction}>
                    <button className="btn ghost small" type="submit">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a href="/login">Log in</a>
                  <a href="/register">Register</a>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="wrap">
          <p>
            Quaere is a game where claims are tested in public and the test leaves something
            behind. This is the bounty board: a patron funds a case, and claimants answer the
            call.
          </p>
        </footer>
      </body>
    </html>
  );
}
