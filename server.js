const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'حسابات');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helper: Read excel file safely ──────────────────────────────
function readExcelFile(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  
  let notes = '';
  if (wb.SheetNames.includes('Metadata')) {
    const metaWs = wb.Sheets['Metadata'];
    const metaData = XLSX.utils.sheet_to_json(metaWs, { header: 1, defval: '' });
    if (metaData.length > 0 && metaData[0].length > 0) {
      notes = String(metaData[0][0] || '');
    }
  }

  return { wb, ws, data, notes };
}

// ─── GET /api/cards — List all cards ─────────────────────────────
app.get('/api/cards', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));
    const cards = files.map(f => {
      try {
        const { data } = readExcelFile(path.join(DATA_DIR, f));
        const name = f.replace('.xlsx', '');
        const headers = (data[0] || []).map(h => (h != null ? String(h) : ''));
        const rows = data.slice(1).filter(r => r && r.some(c => c !== null && c !== undefined && c !== ''));
        return {
          name,
          fileName: f,
          headers: headers.filter(h => h !== ''),
          rowCount: rows.length,
          columnCount: headers.filter(h => h !== '').length
        };
      } catch (e) {
        return {
          name: f.replace('.xlsx', ''),
          fileName: f,
          headers: [],
          rowCount: 0,
          columnCount: 0,
          error: e.message
        };
      }
    });
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cards/:name — Get card data ────────────────────────
app.get('/api/cards/:name', (req, res) => {
  const fileName = req.params.name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  try {
    const { data } = readExcelFile(filePath);
    const rawHeaders = data[0] || [];
    const headers = rawHeaders.map(h => (h != null ? String(h) : ''));

    // Get all non-empty rows
    const rows = data.slice(1).filter(r => r && r.some(c => c !== null && c !== undefined && c !== ''));

    // Pad each row to match header length
    const formattedRows = rows.map(r => {
      const row = [];
      for (let i = 0; i < headers.length; i++) {
        let val = r[i];
        if (val === null || val === undefined) val = '';
        row.push(String(val));
      }
      return row;
    });

    res.json({
      name: req.params.name,
      headers,
      rows: formattedRows,
      notes
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cards/:name/rows — Add a row ─────────────────────
app.post('/api/cards/:name/rows', (req, res) => {
  const fileName = req.params.name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const newRow = req.body.values;
    if (!Array.isArray(newRow)) {
      return res.status(400).json({ error: 'values must be an array' });
    }

    data.push(newRow);

    const newWs = XLSX.utils.aoa_to_sheet(data);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    XLSX.writeFile(wb, filePath);

    const rowNumber = data.length - 1;
    res.json({ success: true, rowNumber });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/cards/:name/rows/:index — Delete a row ──────────
app.delete('/api/cards/:name/rows/:index', (req, res) => {
  const fileName = req.params.name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);
  const rowIndex = parseInt(req.params.index, 10);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // rowIndex is 0-based index of the data rows (excluding header)
    const actualIndex = rowIndex + 1; // +1 for header row
    if (actualIndex < 1 || actualIndex >= data.length) {
      return res.status(400).json({ error: 'Invalid row index' });
    }

    data.splice(actualIndex, 1);

    const newWs = XLSX.utils.aoa_to_sheet(data);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    XLSX.writeFile(wb, filePath);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/cards/:name/rows/:index — Update a row ─────────────
app.put('/api/cards/:name/rows/:index', (req, res) => {
  const fileName = req.params.name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);
  const rowIndex = parseInt(req.params.index, 10);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const actualIndex = rowIndex + 1; // +1 for header row
    if (actualIndex < 1 || actualIndex >= data.length) {
      return res.status(400).json({ error: 'Invalid row index' });
    }

    const newValues = req.body.values;
    if (!Array.isArray(newValues)) {
      return res.status(400).json({ error: 'values must be an array' });
    }

    data[actualIndex] = newValues;

    const newWs = XLSX.utils.aoa_to_sheet(data);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    XLSX.writeFile(wb, filePath);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cards — Create a new card ─────────────────────────
app.post('/api/cards', (req, res) => {
  const { name, columns } = req.body;

  if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ error: 'Name and columns are required' });
  }

  const fileName = name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);

  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: 'Card already exists' });
  }

  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([columns]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filePath);

    res.json({ success: true, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/cards/:name/columns — Edit card columns ──────────────
app.put('/api/cards/:name/columns', (req, res) => {
  const fileName = req.params.name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  const { mappedColumns } = req.body;
  if (!mappedColumns || !Array.isArray(mappedColumns) || mappedColumns.length === 0) {
    return res.status(400).json({ error: 'mappedColumns are required' });
  }

  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    let data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (data.length === 0) {
      data = [mappedColumns.map(c => c.name)];
    } else {
      const newData = [];
      const newHeaders = mappedColumns.map(c => c.name);
      newData.push(newHeaders);

      for (let r = 1; r < data.length; r++) {
        const newRow = mappedColumns.map(c => {
          if (c.oldIndex >= 0 && c.oldIndex < data[r].length) {
            return data[r][c.oldIndex];
          }
          return ''; // new column data
        });
        newData.push(newRow);
      }
      data = newData;
    }

    const newWs = XLSX.utils.aoa_to_sheet(data);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    XLSX.writeFile(wb, filePath);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/cards/:name/rename — Rename a card ──────────────────
app.put('/api/cards/:name/rename', (req, res) => {
  const oldName = req.params.name;
  const { newName } = req.body;

  if (!newName) return res.status(400).json({ error: 'newName is required' });

  const oldPath = path.join(DATA_DIR, oldName + '.xlsx');
  const newPath = path.join(DATA_DIR, newName + '.xlsx');

  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'Card not found' });
  if (fs.existsSync(newPath)) return res.status(409).json({ error: 'Name already exists' });

  try {
    fs.renameSync(oldPath, newPath);
    res.json({ success: true, newName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/cards/:name/notes — Update card notes ──────────────
app.put('/api/cards/:name/notes', (req, res) => {
  const fileName = req.params.name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  const { notes } = req.body;

  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    let metaWs;
    if (!wb.SheetNames.includes('Metadata')) {
      metaWs = XLSX.utils.aoa_to_sheet([[notes || '']]);
      XLSX.utils.book_append_sheet(wb, metaWs, 'Metadata');
    } else {
      metaWs = wb.Sheets['Metadata'];
      XLSX.utils.sheet_add_aoa(metaWs, [[notes || '']], { origin: 'A1' });
    }

    XLSX.writeFile(wb, filePath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cards/:name/export-excel — Export as Excel ─────────
app.get('/api/cards/:name/export-excel', (req, res) => {
  const fileName = req.params.name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  res.download(filePath, fileName);
});

// ─── DELETE /api/cards/:name — Delete a card ─────────────────────
app.delete('/api/cards/:name', (req, res) => {
  const fileName = req.params.name + '.xlsx';
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Card not found' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/export-pdf — Export HTML to PDF via Puppeteer ────
app.post('/api/export-pdf', async (req, res) => {
  const { html, landscape } = req.body;
  
  if (!html) {
    return res.status(400).json({ error: 'HTML content is required' });
  }

  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Set the HTML content
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      landscape: landscape || false
    });
    
    await browser.close();
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length
    });
    
    res.send(pdfBuffer);
  } catch (e) {
    console.error('PDF export error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Fallback: serve index.html for SPA ──────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ✨ Server running at http://localhost:${PORT}\n`);
});
