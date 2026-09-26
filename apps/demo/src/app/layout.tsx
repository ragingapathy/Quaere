import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quaere — single-user demo",
  description: "Play every role yourself to feel the flow of a case, no account or server needed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap top-row">
            <div className="mark">
              <b>Quaere</b>
              <span>single-user demo</span>
            </div>
          </div>
        </header>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
