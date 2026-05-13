import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route to send email
  app.post("/api/send-anamnesis", async (req, res) => {
    const { email, clientName, anamnesisData } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Backup email not configured" });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'Raras Prime Care <onboarding@resend.dev>',
        to: [email],
        subject: `Cópia de Anamnese - ${clientName}`,
        html: `
          <h1>Ficha de Anamnese - ${clientName}</h1>
          <p>Uma nova ficha de anamnese foi registrada no sistema Raras Prime Care.</p>
          <hr />
          <pre>${JSON.stringify(anamnesisData, null, 2)}</pre>
          <hr />
          <p>Este é um backup automático enviado pelo sistema.</p>
        `,
      });

      if (error) {
        return res.status(400).json(error);
      }

      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API Route to send evolution record
  app.post("/api/send-evolution", async (req, res) => {
    const { email, clientName, description, images } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Backup email not configured" });
    }

    try {
      const attachments = images?.map((img: string, idx: number) => {
        const matches = img.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return null;
        return {
          content: matches[2],
          filename: `evolucao_${idx}.png`,
          type: `image/${matches[1]}`,
          disposition: 'attachment'
        };
      }).filter(Boolean);

      const { data, error } = await resend.emails.send({
        from: 'Raras Prime Care <onboarding@resend.dev>',
        to: [email],
        subject: `Evolução de Tratamento - ${clientName}`,
        html: `
          <h1>Registro de Evolução - ${clientName}</h1>
          <p>Um novo registro de evolução foi adicionado ao sistema Raras Prime Care.</p>
          <hr />
          <p><strong>Descrição:</strong></p>
          <p style="white-space: pre-wrap;">${description}</p>
          <hr />
          <p>Este é um backup automático enviado pelo sistema. As fotos foram anexadas a este email.</p>
        `,
        attachments: attachments || []
      });

      if (error) {
        return res.status(400).json(error);
      }

      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
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
