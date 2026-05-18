import { cleanRecord } from './copyUtils';

/** Supported file formats for list export downloads. */
export type ExportFormat = 'csv' | 'xlsx';

/** Column definition used when building export rows. */
export interface ExportColumn {
  dataIndex: string;
  label: string;
}

/** Escape a value for CSV (RFC 4180-style quoting). */
function escapeCsvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/** Escape a value for Excel SpreadsheetML cells. */
function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds a header row and data matrix from records and visible export columns.
 */
export function buildExportMatrix(
  records: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<ExportColumn>
): { headers: string[]; rows: string[][] } {
  const headers = columns.map(c => c.label);
  const rows = records.map(record =>
    columns.map(col => {
      const value = record[ col.dataIndex ];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );
  return { headers, rows };
}

/**
 * Serializes records to a UTF-8 CSV string with BOM for Excel compatibility.
 */
export function recordsToCsv(
  records: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<ExportColumn>
): string {
  const { headers, rows } = buildExportMatrix(records, columns);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

/**
 * Serializes records to Excel SpreadsheetML (.xls) that opens in Microsoft Excel
 * without adding a third-party spreadsheet dependency.
 */
export function recordsToExcelXml(
  records: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<ExportColumn>
): string {
  const { headers, rows } = buildExportMatrix(records, columns);
  const headerRow = headers.map(h =>
    `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
  ).join('');
  const dataRows = rows.map(row => {
    const cells = row.map(cell =>
      `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`
    ).join('');
    return `<Row>${cells}</Row>`;
  }).join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Export">
  <Table>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

/** Triggers a browser download for the given text content. */
export function downloadExportFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([ content ], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Produces a filesystem-safe slug for export filenames. */
export function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'export';
}

/** Removes internal metadata keys before writing export files. */
export function prepareRecordsForExport(
  records: ReadonlyArray<Record<string, unknown>>
): Record<string, unknown>[] {
  return records.map(record => cleanRecord(record));
}
