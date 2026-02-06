console.log("script loaded");

// --------------------
// Globals
// --------------------
let tokens = [];
let guessedWords = [];
const hintContainer = document.getElementById("hint-container");
const artistElement = document.getElementById("artist");
const releaseYearElement = document.getElementById("release-year");
const genreElement = document.getElementById("genre");
const songElement = document.getElementById("song-title");
const searchInput = document.getElementById("searchInput");
const guessButton = document.getElementById("guessButton");
const hintButton = document.getElementById("reveal-hint-button");
const giveUpButton = document.getElementById("give-up-button");
const correctSongTitle = document.getElementById("correct-song-title");
const correctArtist = document.getElementById("correct-artist");
const tableBody = document.getElementById("guessed-words-tbody");
const guessedWordsHeader = document.getElementById("guessed-words-header");
const guessedIncorrectHeader = document.getElementById("guessed-words-incorrect");
//const correctReleaseYear = document.getElementById("correct-release-year");
//const correctGenre = document.getElementById("correct-genre");
let correctGuessesCount = 0;
let totalWordsCount = 0;
let incorrectGuessesCount = 0;
let totalGuessesCount = 0;
const victoryModal = document.getElementById("victory-modal");
const lossModal = document.getElementById("loss-modal");
const fullVictoryModal = document.getElementById("full-victory-modal");
const hintModal = document.getElementById("hint-modal");
let gameDifficulty = "easy"; // default difficulty
let hintCoins = 0; // hints must be built up and spent 
let usedHints = false;
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://karaokey-production.up.railway.app";
// --------------------
// Load songs
// --------------------
async function loadSongs() {
  const response = await fetch(`${API_BASE}/api/songs`);
  const songs = await response.json();
  const randIndex = Math.floor(Math.random() * songs.length);
  console.log(randIndex, songs[randIndex]); // array of objects with metadata + lyrics
  return songs[randIndex]; // just take first song for now
}

// --------------------
// Tokenization
// --------------------
async function tokenizeLyrics(lyrics, song) {     
  const regex = /(\[[a-zA-Z\d\-:* ]+\])|([a-zA-Z']+)|(\n)|([^a-zA-Z\n'\[\]]+)/g;
  const tokens = [];
  // Add metadata as tokens
  tokens.push({ type: "word", text: song.artist, revealed: false, hint: "artist" }, 
              { type: "word", text: song.title, revealed: false, hint: "title", alt: song["alt-title"] });

  if(gameDifficulty === "easy") {
    tokens.push({ type: "word", text: song.releaseYear, revealed: true, hint: "releaseYear" },
                { type: "word", text: song.genre, revealed: true, hint: "genre" });
  }
  else {
    tokens.push({ type: "word", text: song.releaseYear, revealed: false, hint: "releaseYear" },
                { type: "word", text: song.genre, revealed: false, hint: "genre" });
  }
  

  let match;
  while ((match = regex.exec(lyrics)) !== null) {
    if (match[1]) {
      tokens.push({ type: "title", text: match[1], revealed: false });
    } else if (match[2]) {
      totalWordsCount++;
      console.log(match[2], totalWordsCount, "word added");
      tokens.push({ type: "word", text: match[2], revealed: false });
    } else if (match[3]) {
      tokens.push({ type: "newline", text: match[3] });
    } else {
      tokens.push({ type: "other", text: match[4] });
    }
  }

  console.log("tokens after metadata", tokens);
  return tokens;
}

// --------------------
// Rendering
// --------------------
function maskWord(word) {
  return "▇".repeat(word.length);
}

function tokenizeHints(tokens, thisWord) {
  console.log("Tokenizing hints for word:", thisWord);
  return tokens.map(token => {
    if (token.type === "word" && token.text === thisWord) {
      token.isHint = true;
      console.log("Marking token as hint:", token);
      return token;
    }
    return token;
  });
}

function renderLyrics(tokens) {
  console.log("Rendering lyrics with tokens:", tokens);
  const container = document.getElementById("lyrics");
  container.innerHTML = "";

  tokens.forEach(token => {
    const span = document.createElement("span");

    // if player gave up, reveal all words
    if(token.giveUp) {
      span.classList.add("word", "just-revealed", "give-up-revealed");
      span.textContent = token.text;
    }

    // normal rendering
    else if (token.type === "word" && !token.hint) {

      span.textContent = token.revealed
        ? token.text
      : maskWord(token.text);

      if (token.revealed) {
        span.className = "word revealed";
        if (token.isHint) {
          span.classList.add("hint-revealed");
          usedHints = true;
        }
        if (token.justRevealed) {
          span.classList.add("just-revealed");
          token.justRevealed = false; // clear after render
        }
      } else {
          span.className = "word hidden";
        }
      }
      else if (token.type === "newline") {
        span.innerHTML = "<br>";
      } else if (token.type === "title") {
        span.textContent = token.text.replace(/[\[\]]/g, "");
        span.className = "title";
      } else if (token.hint === "artist") {
        let hint = token.revealed ? token.text : maskWord(token.text);
        artistElement.textContent = hint;
      } else if (token.hint === "releaseYear") {
        let hint = token.revealed ? token.text : maskWord(token.text);
        releaseYearElement.textContent = hint;
      } else if (token.hint === "genre") {
        let hint = token.revealed ? token.text : maskWord(token.text);
        genreElement.textContent = hint;
      } else if (token.hint === "title") {
        let hint = token.revealed ? token.text : maskWord(token.text);
        songElement.textContent = hint;
      } else {
        span.textContent = token.text;
      }

      container.appendChild(span);
    });
}

// --------------------
// Game logic
// --------------------
function normalize(word) {
  //console.log("Normalizing word:", word);
  word = word.replace(/em'/g, "them"); // em' -> them
  word = word.replace(/g$/g, ""); // trying removing trailing g's?
  word = word.replace(/'+/g, "").toLowerCase(); // remove apostrophes and lowercase
  word = word.replace(/mm/g, "mmm"); // change mm to mmm
  return word;
}

function applyGuess(guess) {
  console.log("Applying guess:", guess);
  const normalizedGuess = normalize(guess);
  let guessInstances = 0;
  let correctGuess = "";
  let isHint = false;

  for (const entry of guessedWords) {
    if(normalize(entry.word) === normalizedGuess) {
      console.log("Word already guessed:", entry.word);
      console.log("Skipping...");
      entry.justRevealed = true;
      return;
    }
  }

  for (const token of tokens) {
    if (
      token.type === "word" && 
      !token.revealed &&
      normalize(token.text) === normalizedGuess 
    ) {
      token.revealed = true;
      token.justRevealed = true;
      // if revealed by hint button, mark as hints
      if (token.isHint) {
        isHint = true;
      }
      if(token.hint) {
        // only count normal words towards instances
        if(token.hint === "title") {
          console.log("Title revealed!");
          victoryModal.classList.remove("hidden");
        }
        return; // skip metadata hints
      }
      // otherwise increment count
      guessInstances += 1;
      correctGuess = token.text;
    }
  }

  if(correctGuess === "") {
    for (const entry of guessedWords) {
      if(entry.word === normalizedGuess) {
        entry.justRevealed = true;
        return; // already guessed incorrect word
      }
    }
    incorrectGuessesCount++;
    totalGuessesCount++;
    guessedWords.unshift({ word: guess, instances: guessInstances, correct: false, justRevealed: true });
  }  else {
    if(isHint) {  
      console.log("adding hint to guessed words");
      guessedWords.unshift({ word: correctGuess, instances: guessInstances, correct: true, justRevealed: true, isHint:true });
    } else{
      totalGuessesCount++;
      guessedWords.unshift({ word: correctGuess, instances: guessInstances, correct: true, justRevealed: true });
      hintCoins += 1;
      animateHintFill(hintCoins);
    }
  }


  correctGuessesCount += guessInstances;
  console.log("guessedwords:", guessedWords);



  if (correctGuessesCount >= totalWordsCount) {
    console.log("All words guessed!");
    if(usedHints) {
      fullVictoryModal.innerHTML = `
        <h1>WOW TRUE FAN!</h1>
        <h2>But wait, you used hints? Do you even like this song?</h2>
        `;
    }

    fullVictoryModal.classList.remove("hidden");
  }
}

// fill up hint button per number of hint coins
function animateHintFill(hintCoins) {
  let hintsAvailable = Math.floor(hintCoins / 4);
  const percent = Math.min(hintCoins, 4) * 25;
  hintButton.style.backgroundSize = `${percent}% 100%`;
  if (hintCoins >= 4) {
    hintButton.classList.add("filled");
    hintButton.textContent = `Reveal a Word (x${hintsAvailable})`;
  }
  else {
    hintButton.classList.remove("filled");
    hintButton.textContent = `Reveal a Word`;
  } 
}

function renderGuessedTable() {
  guessedWordsHeader.textContent = `Guessed Lyrics (${correctGuessesCount}/${totalWordsCount})`;
  guessedIncorrectHeader.textContent = `Incorrect Guesses (${incorrectGuessesCount}/${totalGuessesCount})`;
  tableBody.innerHTML = `

  `; // Clear existing rows

  if(guessedWords.length === 0) return;
  /*if(guessedWords[0].justRevealed === false) {
    
    return;
  }*/
  for (const entry of guessedWords) {
    const row = document.createElement("tr");
    const wordCell = document.createElement("td");
    const countCell = document.createElement("td");

    wordCell.textContent = entry.word;
    countCell.textContent = entry.instances;
    wordCell.className = entry.correct ? "correct-guess" : "incorrect-guess";
    if(entry.justRevealed) {
      wordCell.classList.add("just-revealed");
    }
    if(entry.isHint) {
      wordCell.classList.add("hint-revealed");
    }

    row.appendChild(wordCell);
    row.appendChild(countCell);
    tableBody.appendChild(row);
    entry.justRevealed = false;
  }





  console.log("Guessed words table rendered.", guessedWords);
}
// -------------------
// Initialization
// --------------------
async function initialize() {
  const song = await loadSongs();
    
  correctSongTitle.textContent = songElement.textContent = song.title;
  correctArtist.textContent = song.artist;
  //correctReleaseYear.textContent = song.releaseYear;
  //correctGenre.textContent = song.genre;

  console.log("Tokens:", tokens);
  tokens = await tokenizeLyrics(song.lyrics, song);
  console.log("Tokens:", tokens);
  renderLyrics(tokens);
  renderGuessedTable();
}

// --------------------
// Event listeners
// --------------------
function main() {
  hintButton.addEventListener("click", () => {
    let hintRevealed = false;
    // If not enough hint coins, show modal
    if(hintCoins < 4) {
      console.log("Not enough hint coins!");
      hintModal.classList.remove("hidden");
      return;
    }
    // Spend hint coins to reveal a random word
    if(hintCoins >= 4) {
      hintCoins -= 4;
      console.log("Revealing a hint word!");
      while (!hintRevealed) {
        const randomIndex = Math.floor(Math.random() * tokens.length);
        const token = tokens[randomIndex];
        if (token.type === "word" && !token.revealed && !token.hint) {
          hintRevealed = true;
          tokens = tokenizeHints(tokens, token.text);
          applyGuess(token.text);
          console.log("Hint revealed:", token);
          break;          
        }

        if(correctGuessesCount >= totalWordsCount) {
          console.log("All words guessed!");
          fullVictoryModal.classList.remove("hidden");
          return;
        }
      }
      renderLyrics(tokens);
      animateHintFill(hintCoins);
      renderGuessedTable();
      return;
    }
  });

  guessButton.addEventListener("click", () => {
    const guess = searchInput.value.trim();
    if (!guess) return;

    applyGuess(guess);
    renderLyrics(tokens);
    renderGuessedTable();
    searchInput.value = "";
  });

  searchInput.addEventListener("keypress", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      guessButton.click();
    }
  });

  giveUpButton.addEventListener("click", () => {
    tokens.forEach(token => {
      if (token.type === "word" & token.revealed === false & !token.hint) {
        token.revealed = true;
        token.giveUp = true;
      } else if(token.hint) {
        token.revealed = true;
      }
    });
    renderLyrics(tokens);
    renderGuessedTable();
    lossModal.classList.remove("hidden");
  });

  artistElement.addEventListener("click", () => {
    console.log("Artist hint clicked");
    artistElement.classList.remove("hidden");
    tokens[0].revealed = true; // artist is first token
    renderLyrics(tokens);
  });

  window.addEventListener("click", (e) => {
    if (e.target === victoryModal | 
        e.target === lossModal | 
        e.target === fullVictoryModal |
        e.target === hintModal) {
      victoryModal.classList.add("hidden");
      lossModal.classList.add("hidden");
      fullVictoryModal.classList.add("hidden");
      hintModal.classList.add("hidden");
    }
  });  
}

// --------------------
// DOM ready
// --------------------
window.addEventListener("DOMContentLoaded", async () => {
  await initialize();
  main();
});
