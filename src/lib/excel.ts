import * as XLSX from 'xlsx';

export type Row = {
  rowIndex: number; // 1-based Excel row index
  C_username?: string;
  D_server?: string | number;
  E_id?: string | number;
  F_status?: string;
};

export function parseWorkbook(file: File) {
  return new Promise<{ workbook: XLSX.WorkBook; firstSheet: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        resolve({ workbook: wb, firstSheet });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function sheetToRows(wb: XLSX.WorkBook, sheetName: string): Row[] {
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<any>(ws, { header: 1, raw: true }); // 2D array
  const rows: Row[] = [];

  for (let i = 1; i < json.length; i++) {
    const r = json[i] || [];
    rows.push({
      rowIndex: i + 1,   // Excel row # (header is row 1)
      C_username: r[2],  // C
      D_server: r[3],    // D
      E_id: r[4],        // E
      F_status: r[5]     // F
    });
  }
  return rows;
}

export function writeRowsToSheet(wb: XLSX.WorkBook, sheetName: string, updated: Row[]) {
  const ws = wb.Sheets[sheetName];
  updated.forEach(row => {
    // C (index 2)
    if (typeof row.C_username !== 'undefined') {
      const cell = XLSX.utils.encode_cell({ r: row.rowIndex - 1, c: 2 });
      ws[cell] = { t: 's', v: String(row.C_username ?? '') };
    }
    // F (index 5)
    if (typeof row.F_status !== 'undefined') {
      const cell = XLSX.utils.encode_cell({ r: row.rowIndex - 1, c: 5 });
      ws[cell] = { t: 's', v: String(row.F_status ?? '') };
    }
  });

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  range.e.c = Math.max(range.e.c, 5);
  ws['!ref'] = XLSX.utils.encode_range(range);
}

export function downloadWorkbook(wb: XLSX.WorkBook, outName = 'verified.xlsx') {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = outName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(rows: Row[], outName = 'verified.csv') {
  const headers = ['Username (C)', 'Server (D)', 'ID (E)', 'Status (F)'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const fields = [
      (r.C_username ?? '').toString().replace(/,/g, ' '),
      (r.D_server ?? '').toString().replace(/,/g, ' '),
      (r.E_id ?? '').toString().replace(/,/g, ' '),
      (r.F_status ?? '').toString().replace(/,/g, ' ')
    ];
    lines.push(fields.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = outName;
  a.click();
  URL.revokeObjectURL(url);
}
