"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getKilled, runNextWave, setKilled } from "@/lib/wave-runner";

export async function toggleKill() {
  setKilled(!getKilled());
  revalidatePath("/", "layout");
}

export async function confirmWave(eventId: string) {
  const result = runNextWave(eventId);
  if (!result.ok) {
    revalidatePath(`/events/${eventId}/waves/new`);
    return;
  }
  revalidatePath("/", "layout");
  redirect(`/events/${eventId}`);
}
