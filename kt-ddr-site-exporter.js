// ==UserScript==
// @name         kt-ddr-site-exporter
// @namespace    https://victoryu.dev/
// @version      0.2a
// @description  Retrieve a JSON of your DDR scores in BATCH-MANUAL format.
// @author       tranq
// @match        https://p.eagate.573.jp/game/ddr/ddra20/p*
// @match        https://p.eagate.573.jp/game/ddr/ddra3/p*
// @grant        none

// @require      https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js
// ==/UserScript==

(() => {
  "use strict";

  const eagateBaseUrl = "https://p.eagate.573.jp/";

  // base url constants
  const baseUrls = {
    A20: {
      SP: "https://p.eagate.573.jp/game/ddr/ddra20/p/playdata/music_data_single.html?offset=",
      DP: "https://p.eagate.573.jp/game/ddr/ddra20/p/playdata/music_data_double.html?offset=",
    },
    A3: {
      SP: "https://p.eagate.573.jp/game/ddr/ddra3/p/playdata/music_data_single.html?offset=",
      DP: "https://p.eagate.573.jp/game/ddr/ddra3/p/playdata/music_data_double.html?offset=",
    },
  };

  // each version has x pages of songs
  const totalPages = {
    A20: {
      SP: 18,
      DP: 18,
    },
    A3: {
      SP: 23,
      DP: 21,
    },
  };

  // button for exporting SP scores
  const buttonSP = document.createElement("button");
  buttonSP.id = "buttonSP";
  buttonSP.textContent = "Export all SP scores";

  // button for exporting DP scores
  const buttonDP = document.createElement("button");
  buttonDP.id = "buttonDP";
  buttonDP.textContent = "Export all DP scores";

  // put them in a div
  const ktContainer = document.createElement("div");
  ktContainer.id = "ktContainer";
  ktContainer.appendChild(buttonSP);
  ktContainer.appendChild(buttonDP);

  document.body.appendChild(ktContainer);

  let scores = [];

  /**
   * Return the DOM of an eagate page.
   * @param {string} url - The URL of the eagate page.
   */
  async function getDOM(url) {
    // get the raw html from the page
    let response = await axios.get(url);
    let pageHtml = response.data;

    const parser = new DOMParser();
    const doc = parser.parseFromString(pageHtml, "text/html");

    return doc;
  }

  /**
   * Disable a button from being clicked.
   * @param {HTMLButtonElement} button
   */
  function disableButton(button) {
    button.disabled = true;
    button.style.cursor = "default";
  }

  /**
   * Enable a button for being clicked.
   * @param {HTMLButtonElement} button
   */
  function enableButton(button) {
    button.disabled = false;
    button.style.cursor = "pointer";
  }

  /**
   * Convert a JST timestamp (as provided by DDR eagate) to unix milliseconds.
   * @param {string} jstTimestamp - A timestamp of the form yyyy-mm-dd hh:mm:ss.
   */
  function convertToUnix(jstTimestamp) {
    let jstFormatted = jstTimestamp.replace(" ", "T") + "+09:00"; // JST is UTC+9
    let date = new Date(jstFormatted);
    let unixMilliseconds = date.getTime();

    return unixMilliseconds;
  }

  /**
   * Determine the lamp for a score given its grade and full combo type.
   * @param {string} grade
   * @param {string} fullComboType
   */
  function computeLamp(grade, fullComboType) {
    if (fullComboType == "---") {
      if (grade == "E") {
        return "FAILED";
      }
      return "CLEAR";
    }

    const lampMap = {
      グッドフルコンボ: "FULL COMBO", // good full combo
      グレートフルコンボ: "GREAT FULL COMBO",
      パーフェクトフルコンボ: "PERFECT FULL COMBO",
      マーベラスフルコンボ: "MARVELOUS FULL COMBO",
    };

    return lampMap[fullComboType];
  }

  /**
   * Given the URL of a score details page, return the score's difficulty.
   * @param {string} url - The URL of the score details page.
   */
  function getDifficulty(url) {
    let diffIndex = Number(url.split("&diff=")[1]);

    const diffMap = {
      // 0-4 = SP, 5-8 = DP
      0: "BEGINNER",
      1: "BASIC",
      2: "DIFFICULT",
      3: "EXPERT",
      4: "CHALLENGE",
      5: "BASIC",
      6: "DIFFICULT",
      7: "EXPERT",
      8: "CHALLENGE",
    };

    return diffMap[diffIndex];
  }

  /**
   * Parse a score into BATCH-MANUAL format.
   * @param {string} url - The URL of the score-details page.
   */
  async function parseScore(url) {
    const doc = await getDOM(url);

    // get the song title
    let musicInfoTable = doc.getElementById("music_info");
    let songTitle = musicInfoTable.rows[0].cells[1].innerHTML.split("<br>")[0];

    // for some reason, "&" still gets returned as "&amp;"
    // this solution kinda sucks but changing the way we get the DOM is too much effort
    songTitle = songTitle.replace(/&amp;/g, "&");

    // some song titles have a trailing space for some reason wtf konami
    // see: https://p.eagate.573.jp/game/ddr/ddra20/p/playdata/music_detail.html?index=6ObP9i0qi1ibbi9DOd6bOOOd6Q9dlPi6
    // hopefully this solution is consistent with the kamaitachi db
    songTitle = songTitle.replace(/\s+$/, ""); // remove only trailing spaces

    // get the score details table
    let musicDetailTable = doc.getElementById("music_detail_table");

    // determine the lamp
    let grade = musicDetailTable.rows[1].cells[1].innerText;
    let fullComboType = musicDetailTable.rows[4].cells[1].innerText;
    let lamp = computeLamp(grade, fullComboType);

    // get the timestamp
    let timeAchieved = musicDetailTable.rows[3].cells[3].innerText;
    timeAchieved = convertToUnix(timeAchieved);

    let scoreObj = {
      score: Number(musicDetailTable.rows[1].cells[3].innerText),
      lamp: lamp,
      matchType: "songTitle",
      identifier: songTitle,
      difficulty: getDifficulty(url),
      timeAchieved: timeAchieved,
    };

    return scoreObj;
  }

  /**
   * Given a play-data page, parse all of its score entries.
   * @param {string} url - The URL of the play-data page.
   */
  async function parsePlayData(url) {
    const doc = await getDOM(url);

    // get the scores table
    let scoresTable = doc.getElementById("data_tbl");

    // iterate over each score
    for (let i = 1; i < scoresTable.rows.length; i++) {
      const row = scoresTable.rows[i];

      for (let j = 1; j < row.cells.length; j++) {
        const scoreCell = row.cells[j];

        // check if a score exists for this entry
        let dataScoreDiv = scoreCell.querySelector("div.data_score");
        if (dataScoreDiv.innerText == "-") {
          continue;
        }

        // get the url to the score's details page
        let linkElement = scoreCell.querySelector("a");
        let relativeUrl = linkElement.getAttribute("href");

        // parse the score
        let scoreObj = await parseScore(eagateBaseUrl + relativeUrl);
        scores.push(scoreObj);
      }
    }
  }

  /**
   * Collect all scores on the play-data pages of the specified version and playtype
   * and export it into a BATCH-MANUAL JSON.
   * @param {"A20" | "A3"} gameVer
   * @param {"SP" | "DP"} playtype
   * @param {HTMLButtonElement} button - The button used to call this function.
   */
  async function exportScores(gameVer, playtype, button) {
    scores = []; // clear the scores array of any previous exports

    let baseUrl = baseUrls[gameVer][playtype];
    let numPages = totalPages[gameVer][playtype];

    // disable both buttons while we're working
    disableButton(buttonSP);
    disableButton(buttonDP);

    try {
      // iterate over every play-data page
      for (let i = 0; i < numPages; i++) {
        button.textContent = `Exporting: Reading page ${i + 1}/${numPages}...`;
        await parsePlayData(baseUrl + i);
      }
    } catch (error) {
      button.textContent = "Failed to read scores. Are you logged in?";
      console.error(error);

      enableButton(buttonSP);
      enableButton(buttonDP);
      return;
    }

    // create the json and prompt a download
    const batchManual = JSON.stringify(
      {
        meta: {
          game: "ddr",
          playtype: playtype,
          service: "kt-ddr-site-exporter",
        },
        scores: scores,
      },
      null,
      2
    );

    const url = URL.createObjectURL(
      new Blob([batchManual], { type: "application/json" })
    );

    const a = document.createElement("a");
    a.href = url;
    a.download = "ddr-export.json";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    button.textContent = `Exported ${scores.length} scores.`;
    enableButton(buttonSP);
    enableButton(buttonDP);
  }

  // determine game ver
  let gameVer;
  let currentUrl = window.location.href;
  if (currentUrl.includes("/ddra20/")) {
    gameVer = "A20";
  } else if (currentUrl.includes("/ddra3/")) {
    gameVer = "A3";
  }

  // button functionality
  buttonSP.addEventListener("click", async () => {
    await exportScores(gameVer, "SP", buttonSP);
  });
  buttonDP.addEventListener("click", async () => {
    await exportScores(gameVer, "DP", buttonDP);
  });

  // button styling
  ktContainer.style.position = "fixed";
  ktContainer.style.top = "10px";
  ktContainer.style.right = "10px";
  ktContainer.style.zIndex = "1000";
  ktContainer.style.display = "flex";
  ktContainer.style.gap = "10px";

  buttonSP.style.padding = "10px 20px";
  buttonSP.style.backgroundColor = "#007bff";
  buttonSP.style.color = "white";
  buttonSP.style.border = "none";
  buttonSP.style.borderRadius = "5px";
  buttonSP.style.cursor = "pointer";

  buttonDP.style.padding = "10px 20px";
  buttonDP.style.backgroundColor = "#7e42f5";
  buttonDP.style.color = "white";
  buttonDP.style.border = "none";
  buttonDP.style.borderRadius = "5px";
  buttonDP.style.cursor = "pointer";
})();
