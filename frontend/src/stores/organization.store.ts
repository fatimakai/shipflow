import { create } from "zustand"

interface OrganizationState {
  activeOrganizationId: string | null
  clearActiveOrganization: () => void
  setActiveOrganization: (activeOrganizationId: string) => void
}

export const useOrganizationStore = create<OrganizationState>((set) => ({
  activeOrganizationId: null,
  clearActiveOrganization: () => set({ activeOrganizationId: null }),
  setActiveOrganization: (activeOrganizationId) =>
    set({ activeOrganizationId }),
}))
