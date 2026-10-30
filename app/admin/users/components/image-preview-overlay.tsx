'use client';

import { memo } from 'react';
import { ActionIcon, Box, Overlay } from '@mantine/core';
import { X } from 'lucide-react';

interface ImagePreviewOverlayProps {
  imagePreview: string | null;
  onClose: () => void;
}

/** 인증 사진 크게 보기 (ESC 닫기는 useImagePreview에서 처리) */
export const ImagePreviewOverlay = memo(function ImagePreviewOverlay({
  imagePreview,
  onClose,
}: ImagePreviewOverlayProps): React.ReactElement | null {
  if (!imagePreview) return null;

  return (
    <Overlay
      fixed
      center
      zIndex={9999}
      backgroundOpacity={0.8}
      p="xl"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Box
        pos='relative'
        maw={896}
        mah='85vh'
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imagePreview}
          alt='인증 사진'
          className='object-contain'
          style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }}
          onClick={(e) => e.stopPropagation()}
        />
        <ActionIcon
          variant='default'
          radius='xl'
          size='lg'
          pos='absolute'
          top={16}
          right={16}
          aria-label='닫기'
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <X size={20} />
        </ActionIcon>
      </Box>
    </Overlay>
  );
});
