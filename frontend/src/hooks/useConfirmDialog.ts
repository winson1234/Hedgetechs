import { useState, useCallback } from 'react';
import type { ConfirmDialogProps } from '../components/ConfirmDialog';

type UseConfirmDialogOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning';
  details?: Array<{ label: string; value: string; highlight?: boolean }>;
};

type UseConfirmDialogReturn = {
  isOpen: boolean;
  openDialog: () => Promise<boolean>;
  closeDialog: () => void;
  dialogProps: ConfirmDialogProps;
};

export function useConfirmDialog(options: UseConfirmDialogOptions): UseConfirmDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const openDialog = useCallback(() => {
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setResolvePromise(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(true);
    }
    closeDialog();
  }, [resolvePromise, closeDialog]);

  const handleCancel = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(false);
    }
    closeDialog();
  }, [resolvePromise, closeDialog]);

  const dialogProps: ConfirmDialogProps = {
    isOpen,
    title: options.title,
    message: options.message,
    confirmText: options.confirmText,
    cancelText: options.cancelText,
    variant: options.variant || 'default',
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    details: options.details
  };

  return {
    isOpen,
    openDialog,
    closeDialog,
    dialogProps
  };
}
