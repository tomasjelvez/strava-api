import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NewEventWizard } from "./new-event-wizard";

export default async function NewEventPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <NewEventWizard />;
}
