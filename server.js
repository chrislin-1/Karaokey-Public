require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = 3000;

// Server static files
app.use(express.static(path.join(__dirname)));

app.get("/api/songs", (req, res) => {
  const songsMetadata = JSON.parse(fs.readFileSync("songs.json", "utf-8"));

  // Read lyrics for each song
  const songsWithLyrics = songsMetadata.map(song => {
    const lyricsPath = path.join(song.lyricsFile);
    const lyrics = fs.readFileSync(lyricsPath, "utf-8");
    return {
      ...song,
      lyrics
    };
  });

  res.json(songsWithLyrics);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});