const REQUIRED_BEATMAP_FIELDS = ["slug", "type", "category", "difficulty", "inputs", "events"];

export function validateSongConfig(songConfig) {
  if (!songConfig || typeof songConfig !== "object") {
    return ["Song config must be an object."];
  }

  const issues = [];
  if (!songConfig.slug || typeof songConfig.slug !== "string") {
    issues.push("Song slug is required.");
  }
  if (!Array.isArray(songConfig.beatmaps)) {
    issues.push("Song beatmaps must be an array.");
  } else {
    songConfig.beatmaps.forEach((beatmap, index) => {
      REQUIRED_BEATMAP_FIELDS.forEach((field) => {
        if (!(field in beatmap)) {
          issues.push(`Beatmap #${index + 1} is missing '${field}'.`);
        }
      });
      if (!Array.isArray(beatmap.inputs)) {
        issues.push(`Beatmap #${index + 1} has invalid inputs.`);
      }
      if (!Array.isArray(beatmap.events)) {
        issues.push(`Beatmap #${index + 1} has invalid events.`);
      }
    });
  }

  return issues;
}

export function interpretSong(songConfig) {
  const beatmaps = Array.isArray(songConfig.beatmaps) ? songConfig.beatmaps : [];
  const beatmapSummaries = beatmaps.map((beatmap) => {
    const inputs = Array.isArray(beatmap.inputs) ? beatmap.inputs : [];
    const events = Array.isArray(beatmap.events) ? beatmap.events : [];

    const noteCount = inputs.reduce((count, input) => {
      if (!Array.isArray(input.notes)) {
        return count;
      }
      return count + input.notes.length;
    }, 0);

    const earliestInput = inputs.length
      ? Math.min(...inputs.map((input) => Number(input.start) || 0))
      : null;

    const latestInput = inputs.length
      ? Math.max(...inputs.map((input) => Number(input.start) || 0))
      : null;

    return {
      slug: beatmap.slug,
      category: beatmap.category,
      difficulty: beatmap.difficulty,
      laneCount: beatmap.laneCount,
      instrumentChoices: Array.isArray(beatmap.instruments) ? beatmap.instruments : [],
      inputCount: inputs.length,
      noteCount,
      eventCount: events.length,
      earliestInput,
      latestInput,
    };
  });

  return {
    slug: songConfig.slug,
    composer: songConfig.composer || "",
    duration: Number(songConfig.duration) || 0,
    scaleKey: songConfig.scaleKey || "",
    scaleType: songConfig.scaleType || "",
    beatmapCount: beatmapSummaries.length,
    beatmaps: beatmapSummaries,
  };
}
