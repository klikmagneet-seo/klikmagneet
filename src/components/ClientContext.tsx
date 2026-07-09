"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getSelectedClientId,
  setSelectedClientId,
  clearSelectedClientId,
} from "@/lib/clientContext";

interface Client {
  id: string;
  name: string;
  industry?: string | null;
}

interface ClientContextValue {
  selectedClient: Client | null;
  setClient: (client: Client) => void;
  clearClient: () => void;
}

const ClientContext = createContext<ClientContextValue>({
  selectedClient: null,
  setClient: () => {},
  clearClient: () => {},
});

export function ClientContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    const clientId = getSelectedClientId();
    if (!clientId) return;

    fetch(`/api/clients/${clientId}`)
      .then((res) => {
        if (!res.ok) {
          clearSelectedClientId();
          return null;
        }
        return res.json();
      })
      .then((data: Client | null) => {
        if (data) {
          setSelectedClient(data);
        }
      })
      .catch(() => {
        clearSelectedClientId();
      });
  }, []);

  function setClient(client: Client) {
    setSelectedClientId(client.id);
    setSelectedClient(client);
  }

  function clearClient() {
    clearSelectedClientId();
    setSelectedClient(null);
  }

  return (
    <ClientContext.Provider value={{ selectedClient, setClient, clearClient }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  return useContext(ClientContext);
}
