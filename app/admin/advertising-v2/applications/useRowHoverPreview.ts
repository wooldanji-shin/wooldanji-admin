'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 미리보기가 뜨기까지 한 행에 머물러야 하는 시간 */
const HOVER_OPEN_DELAY_MS = 3000;
/** 카드로 마우스를 옮기는 동안 닫히지 않게 두는 여유 */
const HOVER_CLOSE_GRACE_MS = 150;

export interface UseRowHoverPreviewReturn<T> {
  /** 미리보기를 띄울 대상 — null이면 닫힌 상태 */
  hovered: T | null;
  /** 마우스 좌표를 따라다니는 0x0 앵커에 붙일 ref */
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  handleRowEnter: (item: T) => void;
  handleRowMove: (e: React.MouseEvent) => void;
  handleRowLeave: () => void;
  /** 카드 위에 마우스가 올라가 있는 동안은 닫지 않는다 */
  handleCardEnter: () => void;
  handleCardLeave: () => void;
}

/**
 * 테이블 행에 일정 시간 머물면 마우스 옆에 미리보기를 띄운다.
 *
 * 행 전체를 트리거로 쓰면 카드가 테이블 오른쪽 끝(=화면 밖)에 붙어버리므로,
 * 마우스 좌표에 0x0 앵커를 두고 거기에 카드를 건다.
 * 좌표는 state가 아니라 DOM style로 직접 옮긴다 — mousemove마다 리렌더되면 표가 버벅인다.
 */
export function useRowHoverPreview<T>(): UseRowHoverPreviewReturn<T> {
  const [hovered, setHovered] = useState<T | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 카드가 떠 있는 동안에는 앵커를 고정한다 (안 그러면 카드가 마우스를 따라 흔들린다)
  const frozen = useRef(false);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const handleRowMove = useCallback((e: React.MouseEvent) => {
    if (frozen.current || !anchorRef.current) return;
    anchorRef.current.style.left = `${e.clientX}px`;
    anchorRef.current.style.top = `${e.clientY}px`;
  }, []);

  const handleRowEnter = useCallback((item: T) => {
    clearTimers();
    frozen.current = false;
    openTimer.current = setTimeout(() => {
      frozen.current = true;
      setHovered(item);
    }, HOVER_OPEN_DELAY_MS);
  }, [clearTimers]);

  const handleRowLeave = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => {
      frozen.current = false;
      setHovered(null);
    }, HOVER_CLOSE_GRACE_MS);
  }, [clearTimers]);

  const handleCardEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const handleCardLeave = useCallback(() => {
    clearTimers();
    frozen.current = false;
    setHovered(null);
  }, [clearTimers]);

  return {
    hovered,
    anchorRef,
    handleRowEnter,
    handleRowMove,
    handleRowLeave,
    handleCardEnter,
    handleCardLeave,
  };
}
