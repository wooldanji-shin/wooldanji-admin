'use client';

import { memo } from 'react';
import type { ReactElement } from 'react';
import { ActionIcon, Box, Overlay } from '@mantine/core';
import { X } from 'lucide-react';

interface ImagePreviewProps {
  imagePreview: string | null;
  onClose: (url: null) => void;
}

/** 인증 사진 크게 보기 */
export const ImagePreview = memo(function ImagePreview({
  imagePreview,
  onClose: setImagePreview,
}: ImagePreviewProps): ReactElement | null {
  if (!imagePreview) return null;

  return (
    <Overlay
      fixed
      center
      zIndex={200}
      backgroundOpacity={0.8}
      p="xl"
      onClick={() => setImagePreview(null)}
    >
      <Box
        pos='relative'
        maw={896}
        mah='85vh'
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <img
          src={imagePreview}
          alt='인증 사진'
          className='object-contain'
          style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }}
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
            e.stopPropagation();
            setImagePreview(null);
          }}
        >
          <X size={20} />
        </ActionIcon>
      </Box>
    </Overlay>
  );
});
