"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
// Remove react-beautiful-dnd imports
// import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuidv4 } from "uuid"; 

// Remove reorder function (handled by arrayMove)

export default function Home() {
  const [images, setImages] = useState([]);
  const [durations, setDurations] = useState([]); // durations per image
  const [videoDuration, setVideoDuration] = useState(2); // default 10 seconds
  const [allDuration, setAllDuration] = useState(2); // for 'Set all durations'
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRefs = useRef({});
  // Remove selectedSong/audio state
  const [resultVideoUrl, setResultVideoUrl] = useState(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState("");
  const someCondition = loading;

  // Add state for built-in music selection
  // Update built-in music options to use real, royalty-free tracks
  const BUILT_IN_MUSIC = [
    {
      url: "/music-1.mp3",
      fileName: "inspiring-corporate.mp3",
      label: "Inspiring Corporate (Local)"
    },
  ];
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [customMusicName, setCustomMusicName] = useState("");
  const [selectedMusicFileName, setSelectedMusicFileName] = useState("");

  // Song list state (built-in + custom)
  const [songs, setSongs] = useState([
    { id: 1, label: "Inspiring Corporate (Local)", fileName: "inspiring-corporate.mp3", type: "builtin" },
  ]);
  const [selectedSongId, setSelectedSongId] = useState(1);
  const fileInputRef = useRef(null);

  // DnD-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // DnD-kit drag end handler
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      setImages((imgs) => arrayMove(imgs, oldIndex, newIndex));
    }
  };

  // Clean up video preview URL only when videoUrl changes
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const [mode, setMode] = useState('images'); // 'images' or 'video'
  // Update durations when images change
  useEffect(() => {
    if (mode === 'images') {
      setDurations(images.map(() => videoDuration));
    }
  }, [images, videoDuration, mode]);

  const [videoFile, setVideoFile] = useState(null);

  // Correct: Always append new images, never overwrite
  const onDrop = useCallback((acceptedFiles) => {
    if (mode === 'images') {
      const imageFiles = acceptedFiles.filter(
        f => f && f.type && f.type.startsWith("image/") && f.size > 0
      );
      if (imageFiles.length !== acceptedFiles.length) {
        alert("Only valid image files are allowed!");
      }
      setImages((prev) => [
        ...prev,
        ...imageFiles.map((file) => ({
          file,
          preview: URL.createObjectURL(file),
          id: uuidv4(),
        })),
      ]);
    } else if (mode === 'video') {
      const vid = acceptedFiles.find(f => f && f.type && f.type.startsWith('video/') && f.size > 0);
      if (!vid) {
        alert('Only valid video files are allowed!');
        return;
      }
      setVideoFile(vid);
    }
  }, [mode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: mode === 'images' ? { "image/*": [] } : { "video/*": [] },
    multiple: mode === 'images',
  });

  const removeImage = (id) => {
    setImages((imgs) => {
      const imgToRemove = imgs.find((img) => img.id === id);
      if (imgToRemove) URL.revokeObjectURL(imgToRemove.preview); // Clean up
      return imgs.filter((img) => img.id !== id);
    });
  };

  // Correct: Insert new image after the given index, preserving all previous images
  const handleInsertImage = (index, file) => {
    if (!file || !file.type || !file.type.startsWith("image/") || file.size === 0) {
      alert("Only valid image files are allowed!");
      return;
    }
    const newImage = {
      file,
      preview: URL.createObjectURL(file),
      id: uuidv4(),
    };
    setImages((imgs) => {
      const newImgs = [...imgs];
      newImgs.splice(index + 1, 0, newImage);
      return newImgs;
    });
  };

  const handlePlusFileChange = (e, idx) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file, i) => {
      handleInsertImage(idx + i, file);
    });
    e.target.value = "";
  };

  // When user selects a song from playlist
  // const handleSongSelect = (song) => {
  //   setSelectedSong(song);
  //   // No fetch here! Only set selectedSong
  // };

  // Update duration for an image
  const handleDurationChange = (idx, value) => {
    setDurations((prev) => prev.map((d, i) => (i === idx ? value : d)));
  };

  // Set all durations to a value
  const handleSetAllDurations = () => {
    setDurations(images.map(() => allDuration));
  };

  // Handle built-in music selection
  const handleBuiltInMusicSelect = (e) => {
    setSelectedMusic(e.target.value);
    const selected = BUILT_IN_MUSIC.find(m => m.url === e.target.value);
    setSelectedMusicFileName(selected ? selected.fileName : "");
    setCustomMusicName("");
  };

  // Handle custom music upload
  const handleCustomMusicUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMusic(file);
      setCustomMusicName(file.name);
    }
  };

  // Remove song from list
  const removeSong = (id) => {
    setSongs(songs => songs.filter(song => song.id !== id));
    if (selectedSongId === id) {
      setSelectedSongId(songs.length > 1 ? songs[0].id : null);
    }
  };

  // Add custom song
  const handleAddCustomSong = () => {
    fileInputRef.current.click();
  };

  const handleCustomSongUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const newSong = {
        id: Date.now(),
        label: file.name,
        file,
        type: "custom"
      };
      setSongs(songs => [...songs, newSong]);
      setSelectedSongId(newSong.id);
      setCustomMusicName(file.name);
    }
  };

  const handleGenerateVideo = async () => {
    setError("");
    setVideoUrl(null);
    if (mode === 'images') {
      if (images.length < 2) {
        setError("Please upload at least 2 images to create a video.");
        return;
      }
    } else if (mode === 'video') {
      if (!videoFile) {
        setError("Please upload a video file.");
        return;
      }
    }
    setLoading(true);
    try {
      const formData = new FormData();
      if (mode === 'images') {
        images.forEach((img) => formData.append("images", img.file));
        formData.append("durations", JSON.stringify(durations));
      } else if (mode === 'video') {
        formData.append('video', videoFile);
        formData.append('duration', videoDuration);
      }
      // Add selected song to formData
      const selectedSong = songs.find(song => song.id === selectedSongId);
      if (selectedSong) {
        if (selectedSong.type === "custom" && selectedSong.file) {
          formData.append("audio", selectedSong.file);
        } else if (selectedSong.type === "builtin" && selectedSong.fileName) {
          formData.append("audioFileName", selectedSong.fileName);
        }
      }
      // Debug logging
      console.log("Selected song:", selectedSong);
      // Print all FormData keys and values for debugging
      for (let pair of formData.entries()) {
        console.log(pair[0]+ ':', pair[1]);
      }
      console.log("FormData keys:", Array.from(formData.keys()));
      const res = await fetch("/api/create-video", {
        method: "POST",
        body: formData,
      });
      if (!res.ok)
        throw new Error((await res.text()) || "Failed to generate video");
      const blobVid = await res.blob();
      setVideoUrl(URL.createObjectURL(blobVid));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  function SortableImage({ id, img, idx, removeImage }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    return (
      <div
        className="relative group snap-center"
        ref={setNodeRef}
        style={style}
        role="button"
        tabIndex={0}
        {...attributes}
        {...listeners}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") removeImage(id);
        }}>
        <img
          src={img.preview}
          alt={`preview-${idx}`}
          className="w-32 h-32 object-cover rounded shadow border-2 border-gray-300 dark:border-gray-600"
        />
        <button
          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs opacity-80 hover:opacity-100"
          onClick={() => removeImage(id)}
          title="Remove"
          type="button"
          aria-label={`Remove image ${idx + 1}`}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center py-8 px-2">
      <h1 className="text-3xl font-bold mb-4 text-center text-gray-800 dark:text-gray-100">
        Multiple Image/Video Uploader & Reorder
      </h1>
      {/* Mode Switcher */}
      <div className="mb-6 flex gap-4">
        <button
          className={`px-4 py-2 rounded ${mode === 'images' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => { setMode('images'); setVideoFile(null); }}
        >
          Create from Images
        </button>
        <button
          className={`px-4 py-2 rounded ${mode === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => { setMode('video'); setImages([]); }}
        >
          Replace Audio in Video
        </button>
      </div>
      {/* Duration input for images mode */}
      {mode === 'images' && (
        <div className="mb-4 flex items-center gap-2">
          <label className="font-semibold">Duration (seconds):</label>
          <input
            type="number"
            min="1"
            value={videoDuration}
            onChange={e => {
              const val = Number(e.target.value);
              setVideoDuration(val);
              setDurations(images.map(() => val));
            }}
            className="ml-2 w-20 px-1 py-0.5 rounded border"
          />
        </div>
      )}
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`w-full max-w-xl border-2 border-dashed rounded-lg p-6 mb-6 cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-white dark:bg-gray-800"
        }`}>
        <input {...getInputProps()} />
        <p className="text-center text-gray-600 dark:text-gray-300">
          {isDragActive
            ? (mode === 'images' ? "Drop the images here ..." : "Drop the video here ...")
            : (mode === 'images' ? "Drag & drop images here, or click to select files" : "Drag & drop a video here, or click to select a video")}
        </p>
      </div>
      {/* Image list (only in images mode) */}
      {mode === 'images' && images.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}>
          <SortableContext
            items={images.map((img) => img.id)}
            strategy={horizontalListSortingStrategy}>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              {images.map((img, idx) => (
                <React.Fragment key={img.id}>
                  <SortableImage
                    id={img.id}
                    img={img}
                    idx={idx}
                    removeImage={removeImage}
                  />
                  {/* Plus button only after the last image */}
                  {idx === images.length - 1 && (
                    <div className="flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        ref={(el) => (fileInputRefs.current[img.id] = el)}
                        onChange={(e) => handlePlusFileChange(e, idx)}
                      />
                      <button
                        type="button"
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl w-8 h-8 flex items-center justify-center shadow-md text-base transition duration-200 ease-in-out hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        title="Insert image after"
                        onClick={() => fileInputRefs.current[img.id]?.click()}
                        aria-label={`Insert image after ${idx + 1}`}>
                        +
                      </button>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {/* Video preview (only in video mode) */}
      {mode === 'video' && videoFile && (
        <div className="w-full max-w-xl flex flex-col items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
          <video
            src={URL.createObjectURL(videoFile)}
            controls
            className="w-full rounded"
            style={{ maxHeight: 400 }}
          />
          <div className="text-sm text-gray-600">{videoFile.name}</div>
        </div>
      )}
      {/* Music Selection UI (same for both modes) */}
      {/* <div className="w-full max-w-xl mb-6 flex flex-col gap-2">
        <label className="font-semibold">Choose built-in music:</label>
        <select
          className="border rounded px-2 py-1"
          value={typeof selectedMusic === "string" ? selectedMusic : ""}
          onChange={handleBuiltInMusicSelect}
        >
          <option value="">None</option>
          {BUILT_IN_MUSIC.map((music) => (
            <option key={music.url} value={music.url}>{music.label}</option>
          ))}
        </select>
        <label className="font-semibold mt-2">Or upload your own music:</label>
        <input
          type="file"
          accept="audio/*"
          onChange={handleCustomMusicUpload}
        />
        {customMusicName && (
          <div className="text-sm text-gray-600">Selected: {customMusicName}</div>
        )}
      </div> */}

      {/* Song List UI (same for both modes) */}
      <div className="w-full max-w-xl mb-6 flex flex-col gap-2">
        {/* <label className="font-semibold">Available Songs:</label>
        <ul className="border rounded divide-y">
          {songs.map(song => (
            <li key={song.id} className="flex items-center justify-between px-2 py-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="selectedSong"
                  checked={selectedSongId === song.id}
                  onChange={() => setSelectedSongId(song.id)}
                />
                {song.label}
              </label>
            
            </li>
          ))}
        </ul> */}
        <button
          type="button"
          className="mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 text-sm w-fit"
          onClick={handleAddCustomSong}
        >
          Add Custom Song
        </button>
        <input
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={handleCustomSongUpload}
        />
        {customMusicName && (
          <div className="text-sm text-gray-600">Selected: {customMusicName}</div>
        )}
      </div>

      {/* Show TrendingSongs only if images are selected */}
      {/* Remove TrendingSongs UI */}

      {/* Generate Video Button */}
      <button
        className="mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded shadow disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={handleGenerateVideo}
        disabled={loading || (mode === 'images' ? images.length < 2 : !videoFile)}
        aria-disabled={loading || (mode === 'images' ? images.length < 2 : !videoFile)}>
        {loading ? "Generating Video..." : (mode === 'images' ? "Generate Video" : "Replace Audio")}
      </button>

      {/* Error Message */}
      {error && (
        <div className="text-red-600 font-semibold mt-4" role="alert">
          {error}
        </div>
      )}

      {/* Video Download Link */}
      {videoUrl && (
        <div className="w-full max-w-xl flex flex-col items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow mt-6">
          <video
            src={videoUrl}
            controls
            // muted
            className="w-full rounded"
            style={{ maxHeight: 400 }}
          />
          <a
            href={videoUrl}
            download="output.mp4"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded shadow">
            Download Video
          </a>
        </div>
      )}

      <footer className="mt-10 text-center text-gray-400 text-xs">
        Built with Next.js, react-dropzone, and react-beautiful-dnd
      </footer>
    </div>
  );
}
