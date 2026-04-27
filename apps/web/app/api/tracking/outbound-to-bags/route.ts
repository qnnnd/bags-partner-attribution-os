import { handleTracking } from "../../../../lib/tracking-handler";
import { TrackingEventType } from "@bags/shared";

export async function POST(req: Request) {
  return handleTracking(req, TrackingEventType.OutboundToBags);
}
