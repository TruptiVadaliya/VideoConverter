import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import formidable from "formidable";
import fetch from "node-fetch";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import ffprobeStatic from "ffprobe-static";
import fsSync from "fs";

const exec = promisify(execCb);

ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function saveFiles(filesArray) {
  const savedFiles = [];
  for (const file of filesArray) {
    if (!file?.filepath) continue;
    const data = await fs.readFile(file.filepath);
    const filename = path.join(tmpdir(), uuidv4() + path.extname(file.originalFilename || ""));
    await fs.writeFile(filename, data);
    savedFiles.push(filename);
  }
  return savedFiles;
}

async function downloadAudioFromUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error("Failed to download audio: " + err.message);
  }
  clearTimeout(timeout);
  if (!res.ok) {
    throw new Error("Failed to download audio: Status " + res.status);
  }
  const buffer = await res.buffer();
  const filePath = path.join(tmpdir(), uuidv4() + ".mp3");
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function getMediaDuration(filePath) {
  try {
    const { stdout } = await exec(`"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
    return parseFloat(stdout.trim()) || 30;
  } catch {
    return 30;
  }
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

    let audioPath = null;
    let tempAudioFile = null;

    try {
      // Handle audio input (uploaded file, server file, or URL)
      if (files.audio) {
        const audioFiles = Array.isArray(files.audio) ? files.audio : [files.audio];
        const savedAudioFiles = await saveFiles(audioFiles);
        audioPath = savedAudioFiles[0];
      } else if (fields.audioFileName) {
        const serverAudioPath = path.join(process.cwd(), "public", "music", fields.audioFileName);
        if (fsSync.existsSync(serverAudioPath)) {
          audioPath = serverAudioPath;
        }
      } else if (fields.audioUrl) {
        audioPath = await downloadAudioFromUrl(fields.audioUrl);
        tempAudioFile = audioPath;
      }

      if (!audioPath) {
        res.status(400).json({ error: "No valid audio file provided." });
        return;
      }

      // Check if a video file is uploaded
      if (files.video) {
        const videoFile = Array.isArray(files.video) ? files.video[0] : files.video;
        if (!videoFile?.filepath) {
          res.status(400).json({ error: "Invalid video file." });
          return;
        }

        const videoData = await fs.readFile(videoFile.filepath);
        const uploadedVideoPath = path.join(tmpdir(), uuidv4() + path.extname(videoFile.originalFilename || ".mp4"));
        await fs.writeFile(uploadedVideoPath, videoData);

        const videoDuration = await getMediaDuration(uploadedVideoPath);
        const audioDuration = await getMediaDuration(audioPath);

        const shouldLoopAudio = videoDuration > audioDuration;

        const outputVideoPath = path.join(tmpdir(), uuidv4() + ".mp4");

        const ffmpegCmd = [
          `-i "${uploadedVideoPath}"`,
          shouldLoopAudio ? `-stream_loop -1 -i "${audioPath}"` : `-i "${audioPath}"`,
          "-map 0:v:0",
          "-map 1:a:0",
          "-c:v copy",
          "-c:a aac",
          "-shortest",
          "-y",
          `"${outputVideoPath}"`
        ].join(" ");

        await exec(`"${ffmpegPath}" ${ffmpegCmd}`);

        const videoBuffer = await fs.readFile(outputVideoPath);

        await Promise.all([uploadedVideoPath, outputVideoPath, tempAudioFile].filter(Boolean).map(async f => {
          try { await fs.unlink(f); } catch {}
        }));

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", "attachment; filename=output.mp4");
        res.status(200).end(videoBuffer);

        return;
      }

      // Handle image-to-video conversion
      const imageFiles = Array.isArray(files.images) ? files.images : [files.images];
      const validImages = imageFiles.filter(f => f?.filepath);

      if (!validImages || validImages.length < 2) {
        res.status(400).json({ error: "Please upload at least 2 images." });
        return;
      }

      const savedImages = await saveFiles(validImages);

      const durations = (() => {
        try {
          const durs = JSON.parse(fields.durations || "[]");
          return Array.isArray(durs) && durs.length === savedImages.length ? durs : Array(savedImages.length).fill(2);
        } catch {
          return Array(savedImages.length).fill(2);
        }
      })();

      const totalDuration = durations.reduce((sum, d) => sum + d, 0);

      const shouldLoopAudio = totalDuration > await getMediaDuration(audioPath);

      const width = Number(fields.width) || 720;
      const height = Number(fields.height) || 1280;
      const videoPath = path.join(tmpdir(), uuidv4() + ".mp4");
      const fileListPath = path.join(tmpdir(), uuidv4() + ".txt");

      const fileListContent = savedImages.map((file, idx) => {
        return `file '${file.replace(/'/g, "'\\''")}'\nduration ${durations[idx]}`;
      }).join("\n") + `\nfile '${savedImages[savedImages.length - 1].replace(/'/g, "'\\''")}'\n`;

      await fs.writeFile(fileListPath, fileListContent);

      const ffmpegCmdParts = [
        `-f concat -safe 0 -i "${fileListPath}"`,
        shouldLoopAudio ? `-stream_loop -1 -i "${audioPath}"` : `-i "${audioPath}"`,
        `-vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black"`,
        "-pix_fmt yuv420p",
        "-r 30",
        `-t ${totalDuration}`,
        "-c:a aac",
        "-b:a 192k",
        `"${videoPath}"`
      ].join(" ");

      await exec(`"${ffmpegPath}" ${ffmpegCmdParts}`);

      const videoBuffer = await fs.readFile(videoPath);

      await Promise.all([...savedImages, fileListPath, videoPath, tempAudioFile].filter(Boolean).map(async f => {
        try { await fs.unlink(f); } catch {}
      }));

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", "attachment; filename=output.mp4");
      res.status(200).end(videoBuffer);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || "Unknown server error." });
    }
  });
}
