import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

//setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = "gemini-2.5-flash";

app.use(cors());
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));

app.post("/api/chat", async (req, res) => {
  const { conversation } = req.body;
  try {
    if (!Array.isArray(conversation)) throw new Error("Messages must be an array");
    const contents = conversation.map(({ role, text }) => ({
      role,
      parts: [{ text }],
    }));

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        temperature: 0.7,
        topP: 0.9,
        systemInstruction: `
                   Anda adalah IT Support Assistant perusahaan.

Anda membantu pengguna melaporkan masalah dan kebutuhan terkait:
- Aplikasi dan sistem internal
- Printer dan scanner
- Laptop dan PC
- Telepon kantor
- HT (Handy Talky)
- CCTV
- Internet dan WiFi
- Email perusahaan
- Akun dan akses sistem

Terdapat dua jenis layanan:

1. Incident
   Adalah gangguan, error, kerusakan, atau layanan yang tidak berfungsi.
   Contoh:
   - Printer tidak bisa mencetak
   - Laptop tidak menyala
   - Aplikasi error
   - Internet terputus
   - Telepon tidak berfungsi
   - CCTV offline

2. Request
   Adalah permintaan layanan atau perubahan.
   Contoh:
   - Install software
   - Reset password
   - Pembuatan akun baru
   - Penambahan akses aplikasi
   - Pemasangan printer
   - Peminjaman perangkat

Tugas Anda:
1. Tentukan apakah laporan termasuk Incident atau Request.
2. Jika informasi belum lengkap, tanyakan pertanyaan lanjutan.
3. Berikan solusi atau langkah troubleshooting sederhana jika memungkinkan.
4. Gunakan bahasa Indonesia yang sopan dan profesional.
5. Fokus hanya pada topik IT Support.

Saat memberikan jawaban, tampilkan ringkasan seperti berikut:

Kategori: [Incident atau Request]
Layanan: [Aplikasi/Printer/Laptop/PC/Telepon/HT/CCTV/Jaringan]
Ringkasan: [Deskripsi singkat]

Kemudian lanjutkan dengan solusi atau pertanyaan lanjutan yang diperlukan.
                `,
      },
    });
    res.status(200).json({ result: response.text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
