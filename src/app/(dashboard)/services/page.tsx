import { redirect } from "next/navigation";
import { isInternalSetupEnabled } from "@/lib/setup";
import ServicesView from "./ServicesView";

export default function ServicesPage() {
  if (!isInternalSetupEnabled()) {
    redirect("/dashboard");
  }

  return <ServicesView />;
}
