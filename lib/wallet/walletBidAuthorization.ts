import type {
  BidAuthorizationPayload,
  SignedBidAuthorization,
} from "@/lib/auction";
import { signArcBidAuthorization } from "@/lib/arc/arcBidAuthorizationAdapter";

export function signWalletBidAuthorization(
  payload: BidAuthorizationPayload
): Promise<SignedBidAuthorization> {
  return signArcBidAuthorization(payload);
}
