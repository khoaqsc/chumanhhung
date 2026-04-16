import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route to publish data to a static JSON file
  app.post("/api/publish", (req, res) => {
    try {
      const data = req.body;
      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ success: false, message: "Dữ liệu gửi lên trống." });
      }

      const publicDir = path.join(process.cwd(), "public");
      const dataPath = path.join(publicDir, "giapha.json");
      
      // Ensure the public directory exists
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
        console.log(`[Server] Created directory: ${publicDir}`);
      }

      console.log(`[Server] Attempting to write to ${dataPath}...`);
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf8");
      
      // Also write to dist/public if it exists (for static deployments)
      const distPublicDir = path.join(process.cwd(), "dist", "public");
      if (fs.existsSync(distPublicDir)) {
        fs.writeFileSync(path.join(distPublicDir, "giapha.json"), JSON.stringify(data, null, 2), "utf8");
        console.log(`[Server] Data also mirrored to ${distPublicDir}`);
      }

      console.log(`[Server] Data published successfully.`);
      res.json({ success: true, message: "Gia phả đã được xuất bản thành công dạng JSON!" });
    } catch (error: any) {
      console.error("[Server] Publish error details:", error);
      res.status(500).json({ 
        success: false, 
        message: `Lỗi khi xuất bản dữ liệu: ${error.message || "Unknown error"}` 
      });
    }
  });

  // API Route to check if static data exists
  app.get("/api/static-info", (req, res) => {
    const dataPath = path.join(process.cwd(), "public", "giapha.json");
    if (fs.existsSync(dataPath)) {
      const stats = fs.statSync(dataPath);
      res.json({ 
        exists: true, 
        updatedAt: stats.mtime,
        size: stats.size
      });
    } else {
      res.json({ exists: false });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
