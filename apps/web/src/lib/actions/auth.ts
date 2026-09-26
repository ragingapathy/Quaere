"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { postLedgerEntry } from "@/lib/ledger";
import { STARTING_GRANT } from "@/lib/constants";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function registerAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !username || password.length < 8) {
    fail("/register", "Email, username, and an 8+ character password are all required.");
  }
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) {
    fail("/register", "Username must be 3-20 letters, numbers, or underscores.");
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    fail("/register", "That email or username is already taken.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email, username, passwordHash } });
    await postLedgerEntry(tx, {
      userId: created.id,
      amount: STARTING_GRANT,
      reason: "STARTING_GRANT",
    });
    return created;
  });

  await createSession(user.id);
  redirect("/bounties");
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    fail("/login", "Incorrect email or password.");
  }

  await createSession(user.id);
  redirect("/bounties");
}

export async function logoutAction(): Promise<void> {
  destroySession();
  redirect("/login");
}
