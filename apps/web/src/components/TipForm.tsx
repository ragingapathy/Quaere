import { tipAction } from "@/lib/actions/tips";
import { MAX_TIP_AMOUNT } from "@/lib/constants";

export function TipForm({
  recipientId,
  recipientName,
  bountyId,
  returnPath,
}: {
  recipientId: string;
  recipientName: string;
  bountyId?: string;
  returnPath: string;
}) {
  return (
    <details style={{ display: "inline-block", marginLeft: 8 }}>
      <summary className="tiny" style={{ display: "inline", cursor: "pointer" }}>
        Tip {recipientName}
      </summary>
      <form action={tipAction.bind(null, recipientId, returnPath)} style={{ marginTop: 6 }}>
        {bountyId && <input type="hidden" name="bountyId" value={bountyId} />}
        <div className="row">
          <input
            type="number"
            name="amount"
            min={1}
            max={MAX_TIP_AMOUNT}
            placeholder="Cred"
            required
            style={{ maxWidth: 90 }}
          />
          <input type="text" name="note" placeholder="Optional note" maxLength={140} style={{ maxWidth: 220 }} />
          <button className="btn small" type="submit">
            Send tip
          </button>
        </div>
      </form>
    </details>
  );
}
