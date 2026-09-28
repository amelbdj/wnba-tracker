// TikTok's FILE_UPLOAD chunking rules (Content Posting API "Media Transfer
// Guide"): each chunk is 5–64 MB, except the final chunk which may be up to
// 128 MB to absorb the remainder; total_chunk_count = floor(video_size /
// chunk_size); 1–1000 chunks; chunks must be uploaded sequentially.
const MAX_CHUNK_SIZE = 64 * 1024 * 1024;
const MAX_SINGLE_CHUNK = 128 * 1024 * 1024; // a lone chunk is also the "final" chunk

export function computeChunkPlan(videoSize) {
  if (videoSize <= MAX_SINGLE_CHUNK) {
    return { chunkSize: videoSize, totalChunkCount: 1 };
  }
  const chunkSize = MAX_CHUNK_SIZE;
  const totalChunkCount = Math.floor(videoSize / chunkSize);
  return { chunkSize, totalChunkCount };
}

function chunkRange(index, totalChunkCount, chunkSize, videoSize) {
  const start = index * chunkSize;
  const end = index === totalChunkCount - 1 ? videoSize - 1 : start + chunkSize - 1;
  return { start, end };
}

// Uploads a File to TikTok's presigned upload_url following the chunk plan
// from computeChunkPlan(), sequentially (required by TikTok), reporting
// overall byte progress via onProgress(fraction). Uses XMLHttpRequest
// instead of fetch so we get real upload-progress events.
export function uploadVideoToTikTok(file, uploadUrl, { chunkSize, totalChunkCount }, onProgress) {
  return new Promise((resolve, reject) => {
    let chunkIndex = 0;

    function uploadNextChunk() {
      const { start, end } = chunkRange(chunkIndex, totalChunkCount, chunkSize, file.size);
      const blob = file.slice(start, end + 1);

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${end}/${file.size}`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const uploadedBefore = start;
        onProgress?.((uploadedBefore + event.loaded) / file.size);
      };

      xhr.onload = () => {
        if (xhr.status !== 200 && xhr.status !== 201 && xhr.status !== 206) {
          reject(new Error(`TikTok upload failed on chunk ${chunkIndex + 1}/${totalChunkCount} (HTTP ${xhr.status}).`));
          return;
        }
        chunkIndex += 1;
        if (chunkIndex >= totalChunkCount) {
          onProgress?.(1);
          resolve();
        } else {
          uploadNextChunk();
        }
      };

      xhr.onerror = () => reject(new Error("Network error while uploading to TikTok."));
      xhr.send(blob);
    }

    uploadNextChunk();
  });
}
