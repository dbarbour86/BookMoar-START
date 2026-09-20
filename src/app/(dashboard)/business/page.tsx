import { redirect } from "next/navigation";
import { isInternalSetupEnabled } from "@/lib/setup";
import BusinessView from "./BusinessView";

export default function BusinessProfilePage() {
  if (!isInternalSetupEnabled()) {
    redirect("/dashboard");
  }

  return <BusinessView />;
}
