"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
// Remove react-beautiful-dnd imports
// import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuidv4 } from "uuid"; // For unique IDs

// Remove reorder function (handled by arrayMove)

export default function Home() {
  const [images, setImages] = useState([]);
  const [durations, setDurations] = useState([]); // durations per image
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
      url: "https://cdn.pixabay.com/audio/2022/10/16/audio_12b6b3b6e7.mp3",
      label: "Inspiring Corporate (Pixabay Music)",
    },
    {
      url: "https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae7c7.mp3",
      label: "Happy Upbeat (Pixabay Music)",
    },
    {
      url: "https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b7b4b.mp3",
      label: "Chill Lo-Fi (Pixabay Music)",
    },
  ];
  const [selectedSampleMusic, setSelectedSampleMusic] = useState("");

  // Enhanced built-in music library
  const MUSIC_LIBRARY = [
    {
      url: "https://cdn.pixabay.com/audio/2022/10/16/audio_12b6b3b6e7.mp3",
      label: "Inspiring Corporate",
      artist: "Pixabay Music",
    },
    {
      url: "https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae7c7.mp3",
      label: "Happy Upbeat",
      artist: "Pixabay Music",
    },
    {
      url: "https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b7b4b.mp3",
      label: "Chill Lo-Fi",
      artist: "Pixabay Music",
    },
    {
      url: "https://cdn.pixabay.com/audio/2023/03/13/audio_128b7b7b7b.mp3",
      label: "Energetic Pop",
      artist: "Pixabay Music",
    },
    {
      url: "https://cdn.pixabay.com/audio/2022/11/16/audio_12c3b3b3b3.mp3",
      label: "Romantic Piano",
      artist: "Pixabay Music",
    },
  ];
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState("");
  const [previewAudio, setPreviewAudio] = useState(null);

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

  // Clean up preview URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [images, videoUrl]);

  // Update durations when images change
  useEffect(() => {
    setDurations((prev) => {
      if (images.length === prev.length) return prev;
      // Add default duration 2s for new images
      return images.map((img, i) => prev[i] || 2);
    });
  }, [images]);

  const onDrop = useCallback((acceptedFiles) => {
    setImages((prev) => [
      ...prev,
      ...acceptedFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        id: uuidv4(),
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  const removeImage = (id) => {
    setImages((imgs) => {
      const imgToRemove = imgs.find((img) => img.id === id);
      if (imgToRemove) URL.revokeObjectURL(imgToRemove.preview); // Clean up
      return imgs.filter((img) => img.id !== id);
    });
  };

  const handleInsertImage = (index, file) => {
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
    const file = e.target.files?.[0];
    if (file) {
      handleInsertImage(idx, file);
    }
    e.target.value = ""; // Reset input
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

  const handleGenerateVideo = async () => {
    setError("");
    setVideoUrl(null);
    if (images.length < 2) {
      setError("Please upload at least 2 images to create a video.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      images.forEach((img) => formData.append("images", img.file));
      formData.append("durations", JSON.stringify(durations));
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

  // SortableImage component for DnD-kit
  function SortableImage({ id, img, idx, removeImage }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
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
        }}
      >
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
          aria-label={`Remove image ${idx + 1}`}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center py-8 px-2">
      <h1 className="text-3xl font-bold mb-4 text-center text-gray-800 dark:text-gray-100">
        Multiple Image Uploader & Reorder
      </h1>

      {/* Audio upload UI */}
      {/* Remove Audio upload UI */}

      {/* Set all durations UI */}
      {images.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-semibold">
            Set all durations (sec):
          </label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={allDuration}
            onChange={(e) => setAllDuration(parseFloat(e.target.value) || 0)}
            className="w-16 px-1 py-0.5 rounded border"
          />
          <button
            type="button"
            className="bg-blue-500 hover:bg-blue-600 text-white rounded px-3 py-1 text-sm"
            onClick={handleSetAllDurations}>
            Apply to all
          </button>
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
            ? "Drop the images here ..."
            : "Drag & drop images here, or click to select files"}
        </p>
      </div>

      {/* Image list */}
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((img) => img.id)} strategy={horizontalListSortingStrategy}>
            <div
              className="flex gap-4 overflow-x-auto mb-6 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg snap-x snap-mandatory"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {images.map((img, idx) => (
                <React.Fragment key={img.id}>
                  <SortableImage id={img.id} img={img} idx={idx} removeImage={removeImage} />
                  {/* Plus button only after the last image */}
                  {idx === images.length - 1 && (
                    <div className="flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        ref={(el) => (fileInputRefs.current[img.id] = el)}
                        onChange={(e) => handlePlusFileChange(e, idx)}
                      />
                      <button
                        type="button"
                        className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow text-sm"
                        title="Insert image after"
                        onClick={() => fileInputRefs.current[img.id]?.click()}
                        aria-label={`Insert image after ${idx + 1}`}
                      >
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

      {/* Show TrendingSongs only if images are selected */}
      {/* Remove TrendingSongs UI */}

      {/* Generate Video Button */}
      <button
        className="mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded shadow disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={handleGenerateVideo}
        disabled={loading || images.length < 2}
        aria-disabled={loading || images.length < 2}>
        {loading ? "Generating Video..." : "Generate Video"}
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
            muted
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
