import { useDisclosure } from "@mantine/hooks";

export interface UseDesignSystemPageReturn {
  modalOpened: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export function useDesignSystemPage(): UseDesignSystemPageReturn {
  const [modalOpened, { open, close }] = useDisclosure(false);
  return { modalOpened, openModal: open, closeModal: close };
}
