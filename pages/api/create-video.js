import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import formidable from "formidable";
import fetch from "node-fetch";
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import ffprobeStatic from "ffprobe-static";
const exec = promisify(execCb);

ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function saveFiles(files) {
  const savedFiles = [];
  for (const file of files) {
    const data = await fs.readFile(file.filepath);
    const filename = path.join(tmpdir(), uuidv4() + path.extname(file.originalFilename));
    await fs.writeFile(filename, data);
    savedFiles.push(filename);
  }
  return savedFiles;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const form = formidable({ multiples: true });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ error: "File upload error" });
      return;
    }
    try {
      const imageFiles = Array.isArray(files.images) ? files.images : [files.images];
      if (!imageFiles || imageFiles.length < 2) {
        res.status(400).json({ error: "Please upload at least 2 images to create a video." });
        return;
      }
      const savedImages = await saveFiles(imageFiles);
      let audioPath = null;
      let tempAudioFile = null;
      try {
        if (files.audio) {
          const audioFiles = Array.isArray(files.audio) ? files.audio : [files.audio];
          const savedAudio = await saveFiles(audioFiles);
          audioPath = savedAudio[0];
          console.log('Audio file uploaded by user:', audioPath);
        } else if (fields.audioUrl) {
          // Download audio from URL with timeout
          console.log('Downloading audio from URL:', fields.audioUrl);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
          let audioRes;
          try {
            audioRes = await fetch(fields.audioUrl, { signal: controller.signal });
          } catch (err) {
            clearTimeout(timeout);
            console.error('Audio download failed:', err);
            res.status(500).json({ error: 'Failed to download audio from URL: ' + err.message });
            return;
          }
          clearTimeout(timeout);
          if (!audioRes.ok) {
            console.error('Audio download failed with status:', audioRes.status);
            res.status(500).json({ error: 'Failed to download audio from URL (status ' + audioRes.status + ')'});
            return;
          }
          const audioBuffer = await audioRes.buffer();
          console.log('Audio file size:', audioBuffer.length);
          tempAudioFile = path.join(tmpdir(), uuidv4() + '.mp3');
          await fs.writeFile(tempAudioFile, audioBuffer);
          audioPath = tempAudioFile;
          console.log('Audio downloaded and saved to:', audioPath);
        }
      } catch (audioErr) {
        console.error('Audio processing error:', audioErr);
        res.status(500).json({ error: 'Audio processing error: ' + audioErr.message });
        return;
      }
      console.log('Using audioPath:', audioPath);

      const videoPath = path.join(tmpdir(), uuidv4() + ".mp4");
      const duration = Number(fields.duration) || 2;
      const width = Number(fields.width) || 720;
      const height = Number(fields.height) || 1280;

      // Read durations from fields (JSON string array)
      let durations = [];
      if (fields.durations) {
        try {
          durations = JSON.parse(fields.durations);
        } catch (e) {
          durations = [];
        }
      }
      if (!Array.isArray(durations) || durations.length !== savedImages.length) {
        durations = Array(savedImages.length).fill(2);
      }

      // Create a file list for ffmpeg concat
      const fileListPath = path.join(tmpdir(), uuidv4() + ".txt");
      let fileListContent = "";
      for (let i = 0; i < savedImages.length; ++i) {
        fileListContent += `file '${savedImages[i].replace(/'/g, "'\\''")}'\nduration ${durations[i]}\n`;
      }
      // Repeat last image for pause at end
      fileListContent += `file '${savedImages[savedImages.length - 1].replace(/'/g, "'\\''")}'\n`;
      await fs.writeFile(fileListPath, fileListContent);

      // Build ffmpeg command to create video from images (NO AUDIO)
      let command = ffmpeg()
        .input(fileListPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions([
          "-vf",
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
        ]);

      command
        .on("start", (cmdLine) => {
          console.log('FFmpeg command:', cmdLine);
        })
        .on("stderr", (stderrLine) => {
          console.log('FFmpeg stderr:', stderrLine);
        })
        .on("end", async () => {
          const videoBuffer = await fs.readFile(videoPath);
          // Clean up temp files
          const cleanupFiles = [...savedImages, fileListPath, videoPath];
          await Promise.all(cleanupFiles.map(async (f) => {
            try {
              await fs.unlink(f);
            } catch (err) {
              if (err.code !== 'ENOENT') throw err;
            }
          }));
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Content-Disposition", "attachment; filename=output.mp4");
          res.status(200).end(videoBuffer);
        })
        .on("error", async (err) => {
          console.error('FFmpeg error:', err);
          const cleanupFiles = [...savedImages, fileListPath, videoPath];
          await Promise.all(cleanupFiles.map(async (f) => {
            try {
              await fs.unlink(f);
            } catch (err) {
              if (err.code !== 'ENOENT') throw err;
            }
          }));
          res.status(500).json({ error: "Video generation failed: " + err.message });
        })
        .save(videoPath);
    } catch (e) {
      res.status(500).json({ error: "Server error: " + e.message });
    }
  });
} 