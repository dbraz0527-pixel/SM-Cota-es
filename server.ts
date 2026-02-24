import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("sm_cotacoes.db");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const upload = multer({ storage: multer.memoryStorage() });

// Database Initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyId INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'employee')) NOT NULL,
    active INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastLoginAt DATETIME,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT CHECK(status IN ('open', 'closed')) DEFAULT 'open',
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quoteId INTEGER NOT NULL,
    companyId INTEGER NOT NULL,
    barcode TEXT NOT NULL,
    productName TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedByUserId INTEGER NOT NULL,
    FOREIGN KEY (quoteId) REFERENCES quotes(id),
    FOREIGN KEY (companyId) REFERENCES companies(id),
    UNIQUE(quoteId, barcode)
  );

  CREATE TABLE IF NOT EXISTS product_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyId INTEGER NOT NULL,
    barcode TEXT NOT NULL,
    productName TEXT NOT NULL,
    lastUsedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    UNIQUE(companyId, barcode)
  );

  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quoteId INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quoteId) REFERENCES quotes(id)
  );
`);

// Seed initial data if empty
const companyCount = db.prepare("SELECT count(*) as count FROM companies").get() as { count: number };
if (companyCount.count === 0) {
  const companyId = db.prepare("INSERT INTO companies (name) VALUES (?)").run("Empresa Matriz").lastInsertRowid;
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (companyId, name, email, password, role) VALUES (?, ?, ?, ?, ?)")
    .run(companyId, "Administrador", "admin@sm.com", hashedPassword, "admin");
  
  const employeePassword = bcrypt.hashSync("123456", 10);
  db.prepare("INSERT INTO users (companyId, name, email, password, role) VALUES (?, ?, ?, ?, ?)")
    .run(companyId, "João Silva", "joao@sm.com", employeePassword, "employee");
}

const app = express();
app.use(express.json());
app.use(cookieParser());

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const isAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

// API Routes
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }
  
  const token = jwt.sign({ id: user.id, companyId: user.companyId, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ id: user.id, name: user.name, role: user.role, companyId: user.companyId });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true });
});

app.get("/api/me", authenticate, (req: any, res) => {
  res.json(req.user);
});

// Employee Routes: Quotes
app.get("/api/quotes", authenticate, (req: any, res) => {
  const { role, id, companyId } = req.user;
  let quotes;
  if (role === "admin") {
    quotes = db.prepare("SELECT q.*, u.name as userName FROM quotes q JOIN users u ON q.userId = u.id WHERE q.companyId = ? ORDER BY q.createdAt DESC").all(companyId);
  } else {
    quotes = db.prepare("SELECT * FROM quotes WHERE userId = ? AND companyId = ? ORDER BY createdAt DESC").all(id, companyId);
  }
  res.json(quotes);
});

app.post("/api/quotes", authenticate, (req: any, res) => {
  const { title, notes } = req.body;
  const { id, companyId } = req.user;
  const result = db.prepare("INSERT INTO quotes (companyId, userId, title, notes) VALUES (?, ?, ?, ?)")
    .run(companyId, id, title, notes);
  res.json({ id: result.lastInsertRowid });
});

app.delete("/api/quotes/:id", authenticate, (req: any, res) => {
  const { id, companyId, role } = req.user;
  const quoteId = req.params.id;

  const quote = db.prepare("SELECT * FROM quotes WHERE id = ? AND companyId = ?").get(quoteId, companyId) as any;
  if (!quote) return res.status(404).json({ error: "Not found" });

  if (role === "employee" && quote.userId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Delete items first
  db.prepare("DELETE FROM quote_items WHERE quoteId = ?").run(quoteId);
  // Delete shares
  db.prepare("DELETE FROM shares WHERE quoteId = ?").run(quoteId);
  // Delete quote
  db.prepare("DELETE FROM quotes WHERE id = ?").run(quoteId);

  res.json({ success: true });
});

app.get("/api/quotes/:id", authenticate, (req: any, res) => {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ? AND companyId = ?").get(req.params.id, req.user.companyId) as any;
  if (!quote) return res.status(404).json({ error: "Not found" });
  
  // Security check: employee can only see their own
  if (req.user.role === "employee" && quote.userId !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const items = db.prepare("SELECT * FROM quote_items WHERE quoteId = ?").all(req.params.id);
  res.json({ ...quote, items });
});

app.patch("/api/quotes/:id/finalize", authenticate, (req: any, res) => {
  const { id, companyId, role } = req.user;
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ? AND companyId = ?").get(req.params.id, companyId) as any;
  if (!quote) return res.status(404).json({ error: "Not found" });
  
  // Security check: employee can only finalize their own
  if (role === "employee" && quote.userId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  db.prepare("UPDATE quotes SET status = 'closed', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Quote Items
app.post("/api/quotes/:id/items", authenticate, (req: any, res) => {
  const { barcode, productName, quantity, saveToCatalog } = req.body;
  const { id, companyId, role } = req.user;
  const quoteId = req.params.id;

  const quote = db.prepare("SELECT * FROM quotes WHERE id = ? AND companyId = ?").get(quoteId, companyId) as any;
  if (!quote || quote.status === "closed") return res.status(400).json({ error: "Cotação fechada ou não encontrada" });

  // Security check: employee can only add to their own
  if (role === "employee" && quote.userId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const existing = db.prepare("SELECT * FROM quote_items WHERE quoteId = ? AND barcode = ?").get(quoteId, barcode) as any;
  
  if (existing) {
    db.prepare("UPDATE quote_items SET quantity = quantity + ?, productName = ?, updatedAt = CURRENT_TIMESTAMP, updatedByUserId = ? WHERE id = ?")
      .run(quantity, productName, id, existing.id);
  } else {
    db.prepare("INSERT INTO quote_items (quoteId, companyId, barcode, productName, quantity, updatedByUserId) VALUES (?, ?, ?, ?, ?, ?)")
      .run(quoteId, companyId, barcode, productName, quantity, id);
  }

  if (saveToCatalog) {
    db.prepare(`
      INSERT INTO product_catalog (companyId, barcode, productName, lastUsedAt, updatedAt) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(companyId, barcode) DO UPDATE SET 
        productName = excluded.productName,
        updatedAt = CURRENT_TIMESTAMP,
        lastUsedAt = CURRENT_TIMESTAMP
    `).run(companyId, barcode, productName);
  } else {
    // Just update lastUsedAt if it exists
    db.prepare(`
      UPDATE product_catalog SET lastUsedAt = CURRENT_TIMESTAMP 
      WHERE companyId = ? AND barcode = ?
    `).run(companyId, barcode);
  }

  res.json({ success: true, updated: !!existing });
});

app.delete("/api/items/:id", authenticate, (req: any, res) => {
  const { id, companyId, role } = req.user;
  const item = db.prepare("SELECT q.userId, q.status, q.companyId FROM quote_items qi JOIN quotes q ON qi.quoteId = q.id WHERE qi.id = ?").get(req.params.id) as any;
  if (!item || item.companyId !== companyId || item.status === "closed") return res.status(403).json({ error: "Forbidden" });
  
  if (role === "employee" && item.userId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  db.prepare("DELETE FROM quote_items WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.patch("/api/items/:id", authenticate, (req: any, res) => {
  const { quantity, productName } = req.body;
  const { id, companyId, role } = req.user;
  
  const item = db.prepare("SELECT q.userId, q.status, q.companyId FROM quote_items qi JOIN quotes q ON qi.quoteId = q.id WHERE qi.id = ?").get(req.params.id) as any;
  if (!item || item.companyId !== companyId || item.status === "closed") return res.status(403).json({ error: "Forbidden" });

  if (role === "employee" && item.userId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  db.prepare("UPDATE quote_items SET quantity = ?, productName = ?, updatedAt = CURRENT_TIMESTAMP, updatedByUserId = ? WHERE id = ?")
    .run(quantity, productName, id, req.params.id);
    
  res.json({ success: true });
});

// Catalog
app.get("/api/catalog/:barcode", authenticate, (req: any, res) => {
  const { barcode } = req.params;
  const item = db.prepare("SELECT productName FROM product_catalog WHERE companyId = ? AND barcode = ?").get(req.user.companyId, barcode) as any;
  
  if (item) {
    return res.json(item);
  }

  // Mock external fallback for demo purposes
  // In a real app, you'd fetch from an API like Open Food Facts or Cosmos
  const mockNames: Record<string, string> = {
    "7891000100103": "Coca-Cola 350ml",
    "7891021001557": "Arroz Tio João 1kg",
    "7891000053508": "Nescau 400g",
    "7891991010856": "Cerveja Skol Latão",
  };

  if (mockNames[barcode]) {
    return res.json({ productName: mockNames[barcode] });
  }

  res.json(null);
});

// Shares
app.post("/api/shares", authenticate, (req: any, res) => {
  const { quoteId } = req.body;
  const { id, companyId, role } = req.user;

  const quote = db.prepare("SELECT * FROM quotes WHERE id = ? AND companyId = ?").get(quoteId, companyId) as any;
  if (!quote) return res.status(404).json({ error: "Cotação não encontrada" });

  // Security: only owner or admin
  if (role === "employee" && quote.userId !== id) {
    return res.status(403).json({ error: "Acesso negado" });
  }

  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  db.prepare("INSERT INTO shares (quoteId, token, expiresAt) VALUES (?, ?, ?)")
    .run(quoteId, token, expiresAt.toISOString());

  const shareUrl = `${process.env.APP_URL}/api/shares/${token}`;
  res.json({ shareUrl, expiresAt: expiresAt.toISOString() });
});

// Admin: Catalog Management
app.get("/api/admin/catalog", authenticate, isAdmin, (req: any, res) => {
  const { search = "", sort = "lastUsedAt_desc" } = req.query;
  const companyId = req.user.companyId;

  let orderBy = "lastUsedAt DESC";
  if (sort === "productName_asc") orderBy = "productName ASC";
  if (sort === "productName_desc") orderBy = "productName DESC";
  if (sort === "updatedAt_desc") orderBy = "updatedAt DESC";

  const catalog = db.prepare(`
    SELECT * FROM product_catalog 
    WHERE companyId = ? AND (productName LIKE ? OR barcode LIKE ?)
    ORDER BY ${orderBy}
  `).all(companyId, `%${search}%`, `%${search}%`);

  res.json(catalog);
});

app.patch("/api/admin/catalog/:id", authenticate, isAdmin, (req: any, res) => {
  const { productName } = req.body;
  const companyId = req.user.companyId;
  const id = req.params.id;

  const result = db.prepare("UPDATE product_catalog SET productName = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND companyId = ?")
    .run(productName, id, companyId);

  if (result.changes === 0) return res.status(404).json({ error: "Item não encontrado" });
  res.json({ success: true });
});

app.get("/api/admin/catalog/export", authenticate, isAdmin, (req: any, res) => {
  const companyId = req.user.companyId;
  const catalog = db.prepare("SELECT barcode, productName, lastUsedAt, updatedAt FROM product_catalog WHERE companyId = ? ORDER BY lastUsedAt DESC").all(companyId) as any[];

  const headers = ['Código de barras', 'Nome do produto', 'Último uso', 'Atualizado em'];
  const rows = catalog.map(item => [item.barcode, item.productName, item.lastUsedAt, item.updatedAt]);
  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="catalogo-produtos.csv"');
  res.send(csvContent);
});

app.post("/api/admin/catalog/import", authenticate, isAdmin, upload.single("file"), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

  try {
    const content = req.file.buffer.toString("utf-8");
    const lines = content.split(/\r?\n/);
    const companyId = req.user.companyId;

    let totalEncontrados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;

    const upsertStmt = db.prepare(`
      INSERT INTO product_catalog (companyId, barcode, productName, lastUsedAt, updatedAt) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(companyId, barcode) DO UPDATE SET 
        productName = excluded.productName,
        updatedAt = CURRENT_TIMESTAMP,
        lastUsedAt = CURRENT_TIMESTAMP
    `);

    const checkStmt = db.prepare("SELECT id, productName FROM product_catalog WHERE companyId = ? AND barcode = ?");

    db.transaction(() => {
      for (const line of lines) {
        if (line.startsWith("|0200|")) {
          const parts = line.split('|').filter(p => p !== '');
          // parts[0] = 0200
          // parts[1] = COD_ITEM
          // parts[2] = NOME_PRODUTO
          // parts[3] = CODIGO_BARRAS
          
          const productName = parts[2]?.trim();
          const barcode = parts[3]?.trim();

          if (barcode && /^\d{13}$/.test(barcode) && productName) {
            totalEncontrados++;
            const existing = checkStmt.get(companyId, barcode) as any;
            upsertStmt.run(companyId, barcode, productName);
            
            if (existing) {
              atualizados++;
            } else {
              inseridos++;
            }
          } else {
            if (line.trim()) ignorados++;
          }
        }
      }
    })();

    res.json({ totalEncontrados, inseridos, atualizados, ignorados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao processar arquivo" });
  }
});

app.get("/api/shares/:token", (req, res) => {
  const share = db.prepare("SELECT * FROM shares WHERE token = ?").get(req.params.token) as any;
  if (!share) return res.status(404).send("Link inválido");

  if (new Date(share.expiresAt) < new Date()) {
    return res.status(410).send("Link expirado");
  }

  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(share.quoteId) as any;
  const items = db.prepare("SELECT * FROM quote_items WHERE quoteId = ?").all(share.quoteId) as any[];

  const headers = ['Código de barras', 'Nome do produto', 'Quantidade a ser pedida'];
  const rows = items.map(item => [item.barcode, item.productName, item.quantity]);
  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${quote.title}-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csvContent);
});

// Admin: User Management
app.get("/api/admin/users", authenticate, isAdmin, (req: any, res) => {
  const users = db.prepare("SELECT id, name, email, role, active, createdAt FROM users WHERE companyId = ?").all(req.user.companyId);
  res.json(users);
});

app.post("/api/admin/users", authenticate, isAdmin, (req: any, res) => {
  const { name, email, password, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare("INSERT INTO users (companyId, name, email, password, role) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.companyId, name, email, hashedPassword, role);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: "Email já cadastrado" });
  }
});

app.patch("/api/admin/users/:id/toggle", authenticate, isAdmin, (req: any, res) => {
  db.prepare("UPDATE users SET active = 1 - active WHERE id = ? AND companyId = ?").run(req.params.id, req.user.companyId);
  res.json({ success: true });
});

app.patch("/api/admin/users/:id", authenticate, isAdmin, (req: any, res) => {
  const { name, email } = req.body;
  db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ? AND companyId = ?").run(name, email, req.params.id, req.user.companyId);
  res.json({ success: true });
});

app.post("/api/admin/users/:id/reset", authenticate, isAdmin, (req: any, res) => {
  const { password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password = ? WHERE id = ? AND companyId = ?").run(hashedPassword, req.params.id, req.user.companyId);
  res.json({ success: true });
});

// Profile Management
app.patch("/api/profile/password", authenticate, (req: any, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare("SELECT password FROM users WHERE id = ?").get(req.user.id) as any;
  
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: "Senha atual incorreta" });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, req.user.id);
  res.json({ success: true });
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
