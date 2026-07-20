<script>
  import { onMount } from 'svelte';
  import { interpretSong, validateSongConfig } from './lib/song-interpreter.js';

  let manifest = { songs: [] };
  let selected = '';
  let status = '';
  let song = {
    slug: '',
    composer: '',
    duration: 0,
    scaleKey: 'c',
    scaleType: 'major',
    guide: [],
    beatmaps: [],
  };
  let guideJson = JSON.stringify(song.guide, null, 2);
  let beatmapsJson = JSON.stringify(song.beatmaps, null, 2);
  const API_BASE = '';
  let selectedBeatmap = 0;
  // removed per-row lane-usage indicator; lane count is declared on beatmap

  async function loadManifest() {
    try {
      const res = await fetch(`/api/manifest`);
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      manifest = await res.json();
    } catch (err) {
      status = `Manifest fetch failed: ${err.message}`;
      throw err;
    }
    // send small manifest summary to server for debugging
    try {
      await fetch(`${API_BASE}/api/_client_loaded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestCount: (manifest.songs || []).length, sample: (manifest.songs || []).slice(0,5) }),
      });
    } catch {}
  }

  async function loadSong(slug) {
    try {
      const res = await fetch(`/api/song/${slug}`);
      if (!res.ok) throw new Error(`song ${res.status}`);
      const payload = await res.json();
      song = payload;
      guideJson = JSON.stringify(song.guide || [], null, 2);
      beatmapsJson = JSON.stringify(song.beatmaps || [], null, 2);
      // ensure visual editor selects first beatmap if present
      if (Array.isArray(song.beatmaps) && song.beatmaps.length) selectedBeatmap = 0;
      status = `Loaded ${slug}`;
    } catch (err) {
      status = `Load song failed: ${err.message}`;
    }
  }

  function newSong() {
    song = {
      slug: '',
      composer: '',
      duration: 0,
      scaleKey: 'c',
      scaleType: 'major',
      guide: [],
      beatmaps: [],
    };
    selected = '';
    guideJson = JSON.stringify(song.guide, null, 2);
    beatmapsJson = JSON.stringify(song.beatmaps, null, 2);
    // add an initial beatmap so the visual editor is visible
    addBeatmap();
    selectedBeatmap = 0;
    status = 'New song template ready.';
  }

  function syncBeatmapsToJson() {
    beatmapsJson = JSON.stringify(song.beatmaps || [], null, 2);
    // reassign song to trigger Svelte reactivity for nested changes
    song = { ...song, beatmaps: Array.isArray(song.beatmaps) ? song.beatmaps.slice() : [] };
  }

  function addBeatmap() {
    if (!Array.isArray(song.beatmaps)) song.beatmaps = [];
    const idx = song.beatmaps.length + 1;
    const bm = {
      slug: `beatmap-${idx}`,
      type: 'default',
      category: 'Original',
      difficulty: 'Easy',
      laneCount: 4,
      instruments: [],
      inputs: [
        { start: 0, lanes: [0], notes: [] },
        { start: 250, lanes: [1], notes: [] },
        { start: 500, lanes: [0,1], notes: [] }
      ],
      events: []
    };
    song.beatmaps.push(bm);
    selectedBeatmap = song.beatmaps.length - 1;
    syncBeatmapsToJson();
  }

  function addInputRow() {
    const bm = (song.beatmaps || [])[selectedBeatmap];
    if (!bm) return;
    if (!Array.isArray(bm.inputs)) bm.inputs = [];
    const lastStart = bm.inputs.length ? Number(bm.inputs[bm.inputs.length-1].start)||0 : 0;
    bm.inputs.push({ start: lastStart + 250, lanes: [], notes: [] });
    syncBeatmapsToJson();
  }

  function toggleLane(input, lane) {
    if (!Array.isArray(input.lanes)) input.lanes = [];
    // default simultaneous toggle
    if (input.sequenceMode) {
      // in sequence mode, toggle sequence position
      toggleLaneSequence(input, lane);
      return;
    }
    if (input.lanes.includes(lane)) {
      input.lanes = input.lanes.filter(x=>x!==lane);
    } else {
      input.lanes = [...input.lanes, lane].sort((a,b)=>a-b);
    }
    syncBeatmapsToJson();
  }

  function toggleLaneSequence(input, lane) {
    if (!Array.isArray(input.laneSequence)) input.laneSequence = [];
    const idx = input.laneSequence.indexOf(lane);
    if (idx >= 0) {
      input.laneSequence.splice(idx, 1);
    } else {
      input.laneSequence.push(lane);
    }
    syncBeatmapsToJson();
  }

  function getLaneOrderIndex(input, lane) {
    if (Array.isArray(input.laneSequence)) {
      const idx = input.laneSequence.indexOf(lane);
      return idx >= 0 ? idx + 1 : null;
    }
    return null;
  }

  function removeInputRow(idx) {
    const bm = (song.beatmaps || [])[selectedBeatmap];
    if (!bm || !Array.isArray(bm.inputs)) return;
    bm.inputs.splice(idx,1);
    syncBeatmapsToJson();
  }

  async function saveSong() {
    try {
      // try to parse any edited JSON fields before save
      try { song.guide = JSON.parse(guideJson || '[]'); } catch(e) { /* ignore parse until user fixes */ }
      try { song.beatmaps = JSON.parse(beatmapsJson || '[]'); } catch(e) { /* ignore parse until user fixes */ }
      const issues = validateSongConfig(song);
      if (issues.length) throw new Error(issues[0]);
      // attempt server save; if it fails, fall back to download
      try {
        const res = await fetch(`/api/song`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(song),
        });
        if (!res.ok) throw new Error(`Server save ${res.status}`);
        await loadManifest();
        status = 'Saved to server.';
      } catch (err) {
        // fallback: download config.json
        downloadConfig(song);
        status = `Saved locally (download) due to server error: ${err.message}`;
      }
    } catch (err) {
      status = err.message;
    }
  }

  function collectSongConfig() {
    return {
      slug: (song.slug || '').trim(),
      composer: song.composer || '',
      duration: Number(song.duration) || 0,
      scaleKey: song.scaleKey || 'c',
      scaleType: song.scaleType || 'major',
      guide: song.guide || [],
      beatmaps: song.beatmaps || [],
    };
  }

  function downloadConfig(config) {
    try {
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.slug || 'config'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      status = `Download failed: ${e.message}`;
    }
  }

  function exportConfig() {
    try {
      const config = collectSongConfig();
      const issues = validateSongConfig(config);
      if (issues.length) throw new Error(issues[0]);
      downloadConfig(config);
      status = 'Downloaded config.json.';
    } catch (e) {
      status = e.message;
    }
  }

  async function importConfigFile(event) {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const cfg = JSON.parse(text);
      song = cfg;
      guideJson = JSON.stringify(song.guide || [], null, 2);
      beatmapsJson = JSON.stringify(song.beatmaps || [], null, 2);
      status = `Imported ${file.name}`;
    } catch (e) {
      status = `Import failed: ${e.message}`;
    } finally {
      // reset input
      event.target.value = '';
    }
  }

  $: interpretation = song.slug ? interpretSong(song) : null;

  onMount(async () => {
    try {
      await loadManifest();
      // diagnostics: notify backend that client mounted
      try { await fetch(`${API_BASE}/api/_client_loaded`, { method: 'POST' }); } catch {}
    } catch (e) {
      status = e.message;
    }
  });
</script>

<main style="font-family: system-ui, sans-serif; padding: 1rem; max-width: 1000px; margin:auto;">
  <h1>DoDoReMi — Svelte Editor</h1>

  <section style="display:flex; gap:1rem;">
    <div style="flex:1; border:1px solid #ddd; padding:1rem; border-radius:6px;">
      <h2>Songs</h2>
      <select bind:value={selected} on:change={() => loadSong(selected)}>
        <option value="">-- Select --</option>
        {#each manifest.songs as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
      <div style="margin-top:0.6rem; display:flex; gap:0.5rem;">
        <button on:click={() => loadSong(selected)}>Load</button>
        <button on:click={newSong}>New</button>
        <button on:click={saveSong}>Save</button>
        <button class="muted" on:click={exportConfig} style="margin-left:0.4rem">Export config</button>
        <input id="config-import" type="file" accept="application/json" on:change={importConfigFile} style="display:none" />
        <button class="muted" on:click={() => document.getElementById('config-import').click()} style="margin-left:0.4rem">Import config</button>
      </div>
      <div style="margin-top:0.8rem; font-weight:700">{status}</div>
    </div>

    <div style="flex:2; border:1px solid #ddd; padding:1rem; border-radius:6px;">
      <h2>Editor</h2>
      <label>Slug</label>
      <input bind:value={song.slug} />
      <label>Composer</label>
      <input bind:value={song.composer} />
      <div style="display:flex; gap:0.6rem;">
        <div style="flex:1">
          <label>Duration (ms)</label>
          <input type="number" bind:value={song.duration} />
        </div>
        <div style="flex:1">
          <label>Scale Key</label>
          <input bind:value={song.scaleKey} />
        </div>
        <div style="flex:1">
          <label>Scale Type</label>
          <input bind:value={song.scaleType} />
        </div>
      </div>

      <label>Guide (JSON)</label>
      <textarea rows="4" bind:value={guideJson} on:input={(e)=>{ try{ song.guide = JSON.parse(e.target.value) }catch{} }}></textarea>

      <label>Beatmaps (JSON)</label>
      <textarea rows="8" bind:value={beatmapsJson} on:input={(e)=>{ try{ song.beatmaps = JSON.parse(e.target.value) }catch{} }}></textarea>
      <div style="margin-top:0.6rem;">
        <button on:click={addBeatmap}>Add Beatmap</button>
        {#if Array.isArray(song.beatmaps) && song.beatmaps.length}
          <label style="margin-left:0.6rem">Visual Beatmap</label>
          <select bind:value={selectedBeatmap} style="margin-left:0.4rem">
            {#each song.beatmaps as bm, i}
              <option value={i}>{bm.slug || `beatmap-${i+1}`}</option>
            {/each}
          </select>
          <div style="margin-top:0.6rem;">
            <label>Tile lanes</label>
            <input type="number" min="1" max="8" bind:value={song.beatmaps[selectedBeatmap].laneCount} on:change={syncBeatmapsToJson} />
            <!-- lane count is declared on the beatmap via the input below -->
            <div style="margin-top:0.6rem;">
              <button on:click={addInputRow}>Add tile row</button>
            </div>
            <div style="margin-top:0.6rem;">
              {#each (song.beatmaps[selectedBeatmap].inputs || []) as input, idx}
                <div style="display:flex; gap:0.4rem; align-items:center; margin-bottom:0.4rem">
                  <input type="number" min="0" value={input.start} on:change={(e) => { input.start = Number(e.target.value)||0; syncBeatmapsToJson(); }} />
                  {#each Array(Math.min(8, song.beatmaps[selectedBeatmap].laneCount || 4)) as _, lane}
                    {#if input.sequenceMode}
                      <button
                        type="button"
                        on:click={() => toggleLaneSequence(input, lane)}
                        class="tile"
                        class:seq={input.laneSequence && input.laneSequence.includes(lane)}
                        aria-pressed={input.laneSequence && input.laneSequence.includes(lane)}
                      >
                        {#if getLaneOrderIndex(input, lane)}
                          {getLaneOrderIndex(input, lane)}
                        {:else}
                          {lane+1}
                        {/if}
                      </button>
                    {:else}
                      <button
                        type="button"
                        on:click={() => toggleLane(input, lane)}
                        class="tile"
                        class:active={input.lanes && input.lanes.includes(lane)}
                        aria-pressed={input.lanes && input.lanes.includes(lane)}
                      >
                        {lane+1}
                      </button>
                    {/if}
                  {/each}
                  <button on:click={()=>removeInputRow(idx)} style="margin-left:0.4rem">×</button>
                  <label style="margin-left:0.6rem; font-size:0.85rem; color:#333"><input type="checkbox" bind:checked={input.sequenceMode} on:change={syncBeatmapsToJson} /> sequence</label>
                  <button style="margin-left:0.6rem" class="muted" on:click={() => { if (!input.laneSequence) input.laneSequence = (input.lanes||[]).slice(); syncBeatmapsToJson(); }}>Make sequence</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <section style="margin-top:1rem; border:1px solid #ddd; padding:1rem; border-radius:6px;">
    <h2>Interpretation</h2>
    {#if interpretation}
      <pre>{JSON.stringify(interpretation, null, 2)}</pre>
    {:else}
      <div>No song loaded.</div>
    {/if}
  </section>
</main>

<style>
  main { max-width: 1100px; margin: 1.2rem auto; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#222; }
  h1 { margin: 0 0 0.6rem; font-size: 1.6rem; }
  section { gap: 1rem; }
  .panel { background: #fff; border: 1px solid #e6e9ee; border-radius: 10px; padding: 1rem; box-shadow: 0 1px 2px rgba(16,24,40,0.03); }
  label { display:block; margin:0.45rem 0 0.15rem; font-weight:600; font-size:0.9rem; color:#333 }
  input, textarea, select { width:100%; padding:0.5rem; border:1px solid #e1e5ea; border-radius:8px; background:#fbfdff; box-sizing:border-box; }
  textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  button { background: #2563eb; color: white; border: none; padding: 0.45rem 0.7rem; border-radius:8px; cursor:pointer; font-weight:600 }
  button:hover { filter:brightness(0.95) }
  .muted { background: transparent; color:#3b3b3b; border:1px solid #e6e9ee }
  .row { display:flex; gap:0.6rem; }
  .song-list { max-height:220px; overflow:auto; padding-right:0.4rem }
  .visual-controls { display:flex; gap:0.6rem; align-items:center; margin-top:0.6rem }
  .tile-row { display:flex; gap:0.4rem; align-items:center }
  .tile-row input[type=number] { width:84px }
  .tile-row button { background:#f1f5f9; color:#0f172a; border:1px solid #e2e8f0; padding:0.35rem 0.45rem; border-radius:6px }
  .tile { background:#eef2f7; color:#0f172a; border:1px solid #e2e8f0; padding:0.35rem 0.45rem; border-radius:6px }
  .tile.active { background:#2563eb; color:#fff; border-color:#1e40af }
  .tile.seq { background:#2563eb; color:#fff; border-color:#1e40af }
  .lane-used { background: linear-gradient(180deg,#10b981,#059669); color:#fff; border:1px solid #047857 }
  .lane-unused { background:#f1f5f9; color:#475569; border:1px solid #e2e8f0 }
  .tile-row button:focus { outline: 2px solid rgba(37,99,235,0.18) }
  ul { margin:0.2rem 0 0; padding-left:1.2rem }
  pre { background:#0f172a; color:#e6eef8; padding:0.8rem; border-radius:8px; overflow:auto }
  @media (max-width:900px){ main{padding:0.8rem} .row{flex-direction:column} }
</style>
