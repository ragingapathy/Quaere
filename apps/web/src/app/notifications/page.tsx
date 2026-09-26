import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";

const TYPE_LABEL: Record<string, string> = {
  SELECTED_AS_CLAIMANT: "Selected as claimant",
  APPLICATION_RECEIVED: "New applicant",
  QUORUM_REACHED: "Quorum reached",
  ROUND_OPENED: "Round opened",
  ROUND_CLOSED: "Round closed",
  VERDICT_READY: "Verdict",
  TIP_RECEIVED: "Tip received",
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=" + encodeURIComponent("Log in to see your notifications."));

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const caseIds = [...new Set(notifications.map((n) => n.caseId).filter((id): id is string => !!id))];
  const cases = await prisma.case.findMany({ where: { id: { in: caseIds } }, select: { id: true, bountyId: true } });
  const caseToBounty = new Map(cases.map((c) => [c.id, c.bountyId]));

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <section className="sheet">
      <div className="spread">
        <h1>Notifications</h1>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button className="btn ghost small" type="submit">
              Mark all read
            </button>
          </form>
        )}
      </div>
      {notifications.length === 0 && <p className="muted small">Nothing yet.</p>}
      {notifications.map((n) => {
        const bountyId = n.caseId ? caseToBounty.get(n.caseId) : undefined;
        return (
          <div className="entry" key={n.id}>
            <div className="spread">
              <div>
                <span className="pill">{TYPE_LABEL[n.type] ?? n.type}</span>
                <p className="small" style={{ margin: "6px 0 2px" }}>
                  {bountyId ? <a href={`/bounties/${bountyId}`}>{n.message}</a> : n.message}
                </p>
                <p className="tiny muted" style={{ margin: 0 }}>
                  {n.createdAt.toLocaleString()}
                </p>
              </div>
              {!n.read && (
                <form action={markNotificationReadAction.bind(null, n.id)}>
                  <button className="btn ghost small" type="submit">
                    Mark read
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
