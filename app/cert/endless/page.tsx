import { requireUser } from "@/lib/cert/session";
import { SUBJECTS } from "@/lib/cert/data";
import { EndlessRunner } from "@/components/cert/EndlessRunner";

export default function EndlessPage() {
  requireUser("/cert/endless");
  return <EndlessRunner subjects={SUBJECTS} />;
}
