const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');

// Route to get video information
router.get('/info', videoController.getVideoInfo);

// Route to handle download
router.get('/download', videoController.downloadVideo);

module.exports = router;
