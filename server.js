require('dotenv').config();
const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Connection ─────────────────────────────────────────
if (!MONGO_URI) {
  console.warn('⚠️ WARNING: MONGO_URI is not defined in .env! Database features will fail.');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// ─── Mongoose Schema ─────────────────────────────────────────────
const cardSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  headers: { type: [String], default: [] },
  rows: { type: [[mongoose.Schema.Types.Mixed]], default: [] },
  notes: { type: String, default: '' }
}, { timestamps: true });

const Card = mongoose.model('Card', cardSchema);

// ─── GET /api/cards — List all cards ─────────────────────────────
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await Card.find({}, 'name headers rows');
    const result = cards.map(c => ({
      name: c.name,
      fileName: c.name + '.xlsx', // Kept for frontend compatibility
      headers: c.headers,
      rowCount: c.rows.length,
      columnCount: c.headers.length
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cards/:name — Get card data ────────────────────────
app.get('/api/cards/:name', async (req, res) => {
  try {
    const card = await Card.findOne({ name: req.params.name });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    
    // Ensure rows are padded to match header length just like before
    const formattedRows = card.rows.map(r => {
      const row = [];
      for (let i = 0; i < card.headers.length; i++) {
        let val = r[i];
        if (val === null || val === undefined) val = '';
        row.push(String(val));
      }
      return row;
    });

    res.json({
      name: card.name,
      headers: card.headers,
      rows: formattedRows,
      notes: card.notes || ''
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cards/:name/rows — Add a row ─────────────────────
app.post('/api/cards/:name/rows', async (req, res) => {
  try {
    const newRow = req.body.values;
    if (!Array.isArray(newRow)) return res.status(400).json({ error: 'values must be an array' });

    const card = await Card.findOne({ name: req.params.name });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    card.rows.push(newRow);
    card.markModified('rows');
    await card.save();

    res.json({ success: true, rowNumber: card.rows.length - 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/cards/:name/rows/:index — Delete a row ──────────
app.delete('/api/cards/:name/rows/:index', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.index, 10);
    const card = await Card.findOne({ name: req.params.name });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    if (rowIndex < 0 || rowIndex >= card.rows.length) {
      return res.status(400).json({ error: 'Invalid row index' });
    }

    card.rows.splice(rowIndex, 1);
    // Due to mixed types, tell mongoose this array changed
    card.markModified('rows');
    await card.save();

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/cards/:name/rows/:index — Update a row ─────────────
app.put('/api/cards/:name/rows/:index', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.index, 10);
    const newValues = req.body.values;
    if (!Array.isArray(newValues)) return res.status(400).json({ error: 'values must be an array' });

    const card = await Card.findOne({ name: req.params.name });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    if (rowIndex < 0 || rowIndex >= card.rows.length) {
      return res.status(400).json({ error: 'Invalid row index' });
    }

    card.rows[rowIndex] = newValues;
    card.markModified('rows');
    await card.save();

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cards — Create a new card ─────────────────────────
app.post('/api/cards', async (req, res) => {
  try {
    const { name, columns } = req.body;
    if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Name and columns are required' });
    }

    const existing = await Card.findOne({ name });
    if (existing) return res.status(409).json({ error: 'Card already exists' });

    const newCard = new Card({
      name,
      headers: columns,
      rows: [],
      notes: ''
    });
    await newCard.save();

    res.json({ success: true, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/cards/:name/columns — Edit card columns ──────────────
app.put('/api/cards/:name/columns', async (req, res) => {
  try {
    const { mappedColumns } = req.body;
    if (!mappedColumns || !Array.isArray(mappedColumns) || mappedColumns.length === 0) {
      return res.status(400).json({ error: 'mappedColumns are required' });
    }

    const card = await Card.findOne({ name: req.params.name });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const newHeaders = mappedColumns.map(c => c.name);
    
    // Remap all existing rows to match new column indexes
    const newRows = card.rows.map(row => {
      return mappedColumns.map(c => {
        if (c.oldIndex >= 0 && c.oldIndex < row.length) {
          return row[c.oldIndex];
        }
        return '';
      });
    });

    card.headers = newHeaders;
    card.rows = newRows;
    card.markModified('headers');
    card.markModified('rows');
    await card.save();

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/cards/:name/rename — Rename a card ──────────────────
app.put('/api/cards/:name/rename', async (req, res) => {
  try {
    const oldName = req.params.name;
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'newName is required' });

    const existing = await Card.findOne({ name: newName });
    if (existing) return res.status(409).json({ error: 'Name already exists' });

    const card = await Card.findOneAndUpdate({ name: oldName }, { name: newName }, { new: true });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    res.json({ success: true, newName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/cards/:name/notes — Update card notes ──────────────
app.put('/api/cards/:name/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    const card = await Card.findOneAndUpdate({ name: req.params.name }, { notes: notes || '' }, { new: true });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cards/:name/export-excel — Export as Excel ─────────
app.get('/api/cards/:name/export-excel', async (req, res) => {
  try {
    const card = await Card.findOne({ name: req.params.name });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const wb = XLSX.utils.book_new();
    
    // Main data sheet
    const wsData = [card.headers, ...card.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    
    // Notes sheet
    if (card.notes) {
      const metaWs = XLSX.utils.aoa_to_sheet([[card.notes]]);
      XLSX.utils.book_append_sheet(wb, metaWs, 'Metadata');
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(card.name)}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/cards/:name — Delete a card ─────────────────────
app.delete('/api/cards/:name', async (req, res) => {
  try {
    const card = await Card.findOneAndDelete({ name: req.params.name });
    if (!card) return res.status(404).json({ error: 'Card not found' });

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
