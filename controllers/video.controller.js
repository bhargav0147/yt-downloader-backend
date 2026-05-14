const youtubedl = require('youtube-dl-exec');
const History = require('../models/History');
const path = require('path');
const fs = require('fs');

const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Function to safely validate YouTube URL
const isValidYoutubeUrl = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  return regex.test(url);
};

exports.getVideoInfo = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || !isValidYoutubeUrl(url)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing YouTube URL' });
    }

    // Fetch video info using yt-dlp via youtube-dl-exec
    const ytDlpOptions = {
      dumpJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
    };
    if (process.env.YOUTUBE_COOKIES_FILE) {
      ytDlpOptions.cookies = process.env.YOUTUBE_COOKIES_FILE;
    }
    const info = await youtubedl(url, ytDlpOptions);

    // Format the response
    const formats = info.formats
      .filter((f) => f.format_note && (f.vcodec !== 'none' || f.acodec !== 'none'))
      .map((f) => ({
        formatId: f.format_id,
        ext: f.ext,
        resolution: f.resolution !== 'audio only' ? f.resolution : null,
        quality: f.format_note,
        vcodec: f.vcodec,
        acodec: f.acodec,
        filesize: f.filesize || f.filesize_approx,
        hasVideo: f.vcodec !== 'none',
        hasAudio: f.acodec !== 'none',
        url: f.url // URL for direct download or streaming
      }));

    res.status(200).json({
      success: true,
      data: {
        id: info.id,
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        channel: info.uploader,
        viewCount: info.view_count,
        formats: formats,
      }
    });

  } catch (error) {
    console.error('Error fetching video info:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch video information', error: error.message });
  }
};

exports.downloadVideo = async (req, res) => {
  try {
    const { url, formatId, type, quality, title } = req.query;

    if (!url || !isValidYoutubeUrl(url)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing YouTube URL' });
    }

    // Basic record creation for analytics
    const historyRecord = await History.create({
      url,
      title: title || 'Unknown Title',
      formatId,
      quality,
      type: type || 'video',
      status: 'started'
    });

    const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = type === 'audio' ? 'mp3' : 'mp4';
    const fileId = Date.now().toString() + Math.floor(Math.random() * 10000);
    const outputTemplate = path.join(tempDir, `${fileId}.%(ext)s`);

    const binDir = path.join(__dirname, '../bin');
    let ytDlpOptions = {
      output: outputTemplate,
      noCheckCertificate: true,
      noWarnings: true,
      ffmpegLocation: binDir,
    };
    if (process.env.YOUTUBE_COOKIES_FILE) {
      ytDlpOptions.cookies = process.env.YOUTUBE_COOKIES_FILE;
    }

    if (type === 'audio') {
      ytDlpOptions.extractAudio = true;
      ytDlpOptions.audioFormat = 'mp3';
    } else {
      ytDlpOptions.format = formatId ? `${formatId}+bestaudio[ext=m4a]/best` : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
      ytDlpOptions.mergeOutputFormat = 'mp4';
    }

    // Download to temp file
    await youtubedl(url, ytDlpOptions);

    // Find the file that was downloaded
    const files = fs.readdirSync(tempDir);
    const downloadedFile = files.find(f => f.startsWith(fileId));

    if (downloadedFile) {
      const actualPath = path.join(tempDir, downloadedFile);
      const actualExt = downloadedFile.split('.').pop();
      
      res.download(actualPath, `${safeTitle}.${actualExt}`, async (err) => {
        // Clean up temp file
        fs.unlink(actualPath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
        });
        
        if (!err) {
          await History.findByIdAndUpdate(historyRecord._id, { status: 'completed' });
        }
      });
    } else {
      throw new Error("Downloaded file not found");
    }

  } catch (error) {
    console.error('Error downloading video:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Download failed', error: error.message });
    }
  }
};
