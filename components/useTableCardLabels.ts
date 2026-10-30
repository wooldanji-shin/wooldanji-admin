import { useEffect } from 'react';

/** 휴대폰에서 표 행을 카드로 보여줄 때 각 칸 앞에 붙일 열 이름을 data-label로 달아 둔다 */
function labelTable(table: HTMLTableElement): void {
  if (table.hasAttribute('data-no-cards')) return;

  const headerRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headerRow) return;

  // colSpan을 고려해 열 위치별 헤더 이름을 만든다
  const labels: string[] = [];
  Array.from(headerRow.cells).forEach((th) => {
    const text = (th.textContent ?? '').trim();
    for (let i = 0; i < th.colSpan; i += 1) labels.push(text);
  });

  Array.from(table.tBodies).forEach((tbody) => {
    Array.from(tbody.rows).forEach((row) => {
      let column = 0;
      Array.from(row.cells).forEach((cell) => {
        const label = cell.colSpan > 1 ? '' : (labels[column] ?? '');
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
        column += cell.colSpan;
      });
    });
  });
}

function labelAllTables(root: ParentNode): void {
  root.querySelectorAll('table').forEach((table) => labelTable(table as HTMLTableElement));
}

/** 화면의 모든 표를 지켜보다가 행이 바뀌면 열 이름을 다시 단다 */
export function useTableCardLabels(): void {
  useEffect(() => {
    labelAllTables(document);

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        labelAllTables(document);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, []);
}
