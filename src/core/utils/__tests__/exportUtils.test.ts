import {
  buildExportMatrix,
  recordsToCsv,
  sanitizeFilenamePart,
} from '../exportUtils';

describe('exportUtils', () => {
  const columns = [
    { dataIndex: 'name', label: 'Name' },
    { dataIndex: 'email', label: 'Email' },
  ];

  const records = [
    { name: 'Alice', email: 'alice@example.com', __raw__: {} },
    { name: 'Bob', email: 'bob@example.com' },
  ];

  it('buildExportMatrix maps visible columns to headers and rows', () => {
    const { headers, rows } = buildExportMatrix(records, columns);
    expect(headers).toEqual([ 'Name', 'Email' ]);
    expect(rows).toEqual([
      [ 'Alice', 'alice@example.com' ],
      [ 'Bob', 'bob@example.com' ],
    ]);
  });

  it('recordsToCsv quotes cells that contain commas', () => {
    const csv = recordsToCsv(
      [ { name: 'Last, First', email: 'x@y.com' } ],
      columns
    );
    expect(csv).toContain('"Last, First"');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('sanitizeFilenamePart removes unsafe characters', () => {
    expect(sanitizeFilenamePart('Order Listing!')).toBe('Order-Listing');
  });
});
