import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { SourceChunk, SourceFileType } from '../src/types.ts';

export interface ParsedDocument {
  fileType: SourceFileType;
  rawText: string;
  chunks: SourceChunk[];
}

export function detectFileType(filename: string, mimeType?: string): SourceFileType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') return 'pdf';
  if (
    lower.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  if (lower.endsWith('.csv') || mimeType === 'text/csv') return 'csv';
  if (lower.endsWith('.txt') || lower.endsWith('.md') || mimeType?.startsWith('text/plain')) {
    return 'txt';
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvContent(text: string): SourceChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const dataLines = lines.slice(1);

  if (dataLines.length === 0) {
    return [
      {
        location: 'Row 1',
        text: headers.join(' | '),
      },
    ];
  }

  return dataLines.map((line, index) => {
    const cols = parseCsvLine(line);
    const formatted = headers
      .map((header, colIdx) => `${header || `Column${colIdx + 1}`}: ${cols[colIdx] ?? ''}`)
      .join(' | ');
    return {
      location: `Row ${index + 1}`,
      text: formatted,
    };
  });
}

function parseTxtContent(text: string): SourceChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (blocks.length === 1 && blocks[0].includes('\n')) {
    const lines = blocks[0]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length > 4) {
      const grouped: SourceChunk[] = [];
      for (let i = 0; i < lines.length; i += 4) {
        grouped.push({
          location: `Paragraph ${Math.floor(i / 4) + 1}`,
          text: lines.slice(i, i + 4).join('\n'),
        });
      }
      return grouped;
    }
  }

  return blocks.map((block, index) => ({
    location: `Paragraph ${index + 1}`,
    text: block,
  }));
}

async function parsePdfBuffer(buffer: Buffer): Promise<SourceChunk[]> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useWorkerFetch: false,
    disableFontFace: true,
    verbosity: 0,
  });

  const pdfDoc = await loadingTask.promise;
  const chunks: SourceChunk[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const strings = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter((s) => s.trim().length > 0);
    const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
    if (pageText) {
      chunks.push({
        location: `Page ${pageNum}`,
        text: pageText,
      });
    }
  }

  return chunks;
}

async function parseDocxBuffer(buffer: Buffer): Promise<SourceChunk[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const sections = text
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sections.map((sec, index) => ({
    location: `Section ${index + 1}`,
    text: sec,
  }));
}

export async function parseDocumentBuffer(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ParsedDocument> {
  const fileType = detectFileType(filename, mimeType);
  if (!fileType) {
    throw new Error('Unsupported file format. Please upload PDF, DOCX, TXT, or CSV files.');
  }

  let chunks: SourceChunk[] = [];

  if (fileType === 'pdf') {
    chunks = await parsePdfBuffer(buffer);
  } else if (fileType === 'docx') {
    chunks = await parseDocxBuffer(buffer);
  } else if (fileType === 'csv') {
    chunks = parseCsvContent(buffer.toString('utf-8'));
  } else {
    chunks = parseTxtContent(buffer.toString('utf-8'));
  }

  if (chunks.length === 0) {
    throw new Error(
      `No extractable text was found in "${filename}". Ensure the file is not empty or a scanned image-only PDF.`
    );
  }

  const rawText = chunks.map((c) => `[${c.location}]\n${c.text}`).join('\n\n');

  return {
    fileType,
    rawText,
    chunks,
  };
}
