import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

// Handle SPA routing: send index.html for all non-static requests
app.use((req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Not Found');
  }

  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Inject environment variables into the window object
  const envConfig = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
  };
  
  const injectScript = `
    <script>
      window.process = window.process || {};
      window.process.env = window.process.env || {};
      window.process.env.GEMINI_API_KEY = ${JSON.stringify(envConfig.GEMINI_API_KEY)};
    </script>
  `;
  
  content = content.replace('<head>', `<head>${injectScript}`);
  res.send(content);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
