import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { prisma } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quaere — a court for claims",
  description: "A patron funds a bounty. A claimant stakes a claim. The audience decides.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await prisma.notification.count({ where: { userId: user.id, read: false } }) : 0;

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
                  <a href="/mine">My cases</a>
                  <a href="/notifications" style={{ position: "relative" }}>
                    Notifications
                    {unread > 0 && (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        {unread}
                      </span>
                    )}
                  </a>
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
        <footer className="site-footer">
          <div className="wrap">
            <div className="brand">
              <span className="wordmark">Quaere</span>
              A game where claims are tested in public and the test leaves something behind. A
              patron funds a case; a claimant stakes a claim; the audience decides.
            </div>
            <div className="cols">
              <div className="col">
                <h4>Play</h4>
                <a href="/bounties">Bounty board</a>
                <a href="/bounties/new">Post a bounty</a>
                <a href="/mine">My cases</a>
              </div>
              <div className="col">
                <h4>Learn</h4>
                <a href="/how-it-works">How it works</a>
              </div>
              <div className="col">
                <h4>Account</h4>
                {user ? (
                  <>
                    <a href="/notifications">Notifications</a>
                    <a href="/login">Switch account</a>
                  </>
                ) : (
                  <>
                    <a href="/login">Log in</a>
                    <a href="/register">Register</a>
                  </>
                )}
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
