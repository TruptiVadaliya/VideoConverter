import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import formidable from "formidable";

ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function saveFile(file) {
  const data = await fs.readFile(file.filepath);
  const filename = path.join(tmpdir(), uuidv4() + path.extname(file.originalFilename));
  await fs.writeFile(filename, data);
  return filename;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ error: "File upload error" });
      return;
    }
    try {
      if (!files.video || !files.audio) {
        res.status(400).json({ error: "Both video and audio files are required." });
        return;
      }
      const videoPath = await saveFile(files.video);
      const audioPath = await saveFile(files.audio);
      const outputPath = path.join(tmpdir(), uuidv4() + ".mp4");

      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          "-map", "0:v:0",
          "-map", "1:a:0",
          "-c:v", "copy",
          "-shortest"
        ])
        .on("end", async () => {
          const videoBuffer = await fs.readFile(outputPath);
          await Promise.all([fs.unlink(videoPath), fs.unlink(audioPath), fs.unlink(outputPath)]);
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Content-Disposition", "attachment; filename=output_with_music.mp4");
          res.status(200).end(videoBuffer);
        })
        .on("error", async (err) => {
          await Promise.all([fs.unlink(videoPath), fs.unlink(audioPath)]);
          res.status(500).json({ error: "Failed to add music: " + err.message });
        })
        .save(outputPath);
    } catch (e) {
      res.status(500).json({ error: "Server error: " + e.message });
    }
  });
} 