import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { jsPDF } from 'jspdf'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const flattenForPdf = (data: any, indent = 0): string[] => {
  const lines: string[] = []
  const prefix = ' '.repeat(indent * 2)

  if (data === null || data === undefined) {
    lines.push(`${prefix}null`)
    return lines
  }

  if (typeof data === 'string') {
    data.split('\n').forEach((line) => lines.push(`${prefix}${line}`))
    return lines
  }

  if (typeof data !== 'object') {
    lines.push(`${prefix}${String(data)}`)
    return lines
  }

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      lines.push(`${prefix}- ${typeof item === 'object' ? '' : String(item)}`)
      if (typeof item === 'object') {
        lines.push(...flattenForPdf(item, indent + 1))
      }
    })
    return lines
  }

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      lines.push(`${prefix}${key}:`)
      lines.push(...flattenForPdf(value, indent + 1))
    } else {
      lines.push(`${prefix}${key}: ${String(value)}`)
    }
  })
  return lines
}

export function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPDF(data: any, filename: string, title = 'Analysis Report') {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;

  doc.setFontSize(18);
  doc.text(title, margin, 50);
  doc.setFontSize(11);

  const lines = flattenForPdf(data, 0);
  const wrappedLines = doc.splitTextToSize(lines.join('\n'), maxWidth);

  let y = 75;
  wrappedLines.forEach((line) => {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 14;
  });

  doc.save(filename);
}
