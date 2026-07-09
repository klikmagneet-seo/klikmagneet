"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSelectedClientId } from "@/lib/clientContext";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const clientId = getSelectedClientId();
    if (clientId) {
      router.replace("/dashboard");
    } else {
      router.replace("/clients");
    }
  }, [router]);

  return null;
}
