import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, FolderOpen, Sliders, Music, Disc } from 'lucide-react';

interface Track {
  id: number;
  title: string;
  album: string;
  trackNo: number;
  url: string;
}

export default function QuellqaAudio() {
  const version = "v1.0.0";
  
  // --- State Management ---
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // EQ & Pre-Amp states (in Decibels)
  const [preamp, setPreamp] = useState<number>(0);
  const [bass, setBass] = useState<number>(3); // Default slight bass boost
  const [mid, setMid] = useState<number>(0);
  const [treble, setTreble] = useState<number>(1.5);

  // --- Web Audio API Refs ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  // Filter Node Refs
  const preampNodeRef = useRef<GainNode | null>(null);
  const bassNodeRef = useRef<BiquadFilterNode | null>(null);
  const midNodeRef = useRef<BiquadFilterNode | null>(null);
  const trebleNodeRef = useRef<BiquadFilterNode | null>(null);

  // ----------------------------------------------------
  // EFFECT: Dynamic Document Title Updates
  // ----------------------------------------------------
  useEffect(() => {
    if (currentIdx !== -1 && playlist[currentIdx]) {
      document.title = `▶ ${playlist[currentIdx].title} | Quellqa Audio`;
    } else {
      document.title = `Quellqa Audio ${version}`;
    }
  }, [currentIdx, playlist]);

  // ----------------------------------------------------
  // INITIALIZE WEB AUDIO GRAPH
  // ----------------------------------------------------
  const initAudioGraph = () => {
    if (!audioRef.current || audioCtxRef.current) return;

    // 1. Create Context & Source
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);
    sourceRef.current = source;

    // 2. Create Nodes
    const preampNode = ctx.createGain();
    const bassNode = ctx.createBiquadFilter();
    const midNode = ctx.createBiquadFilter();
    const trebleNode = ctx.createBiquadFilter();

    // 3. Configure Filter Types & Frequencies
    bassNode.type = 'lowshelf';
    bassNode.frequency.value = 150; // Bass boundary

    midNode.type = 'peaking';
    midNode.Q.value = 1.0; // Filter bandwidth
    midNode.frequency.value = 1000; // Mid boundary

    trebleNode.type = 'highshelf';
    trebleNode.frequency.value = 5000; // Treble boundary

    // 4. Connect the Pipeline
    source.connect(preampNode);
    preampNode.connect(bassNode);
    bassNode.connect(midNode);
    midNode.connect(trebleNode);
    trebleNode.connect(ctx.destination);

    // Save refs for runtime manipulation
    preampNodeRef.current = preampNode;
    bassNodeRef.current = bassNode;
    midNodeRef.current = midNode;
    trebleNodeRef.current = trebleNode;

    // Apply initial slider values
    updateDspValues();
  };

  // Sync state parameters to active Web Audio nodes
  const updateDspValues = () => {
    // Convert dB value to actual linear amplitude gain for Pre-Amp
    if (preampNodeRef.current) {
      const gainLinear = Math.pow(10, preamp / 20);
      preampNodeRef.current.gain.setValueAtTime(gainLinear, audioCtxRef.current?.currentTime || 0);
    }
    if (bassNodeRef.current) bassNodeRef.current.gain.setValueAtTime(bass, audioCtxRef.current?.currentTime || 0);
    if (midNodeRef.current) midNodeRef.current.gain.setValueAtTime(mid, audioCtxRef.current?.currentTime || 0);
    if (trebleNodeRef.current) trebleNodeRef.current.gain.setValueAtTime(treble, audioCtxRef.current?.currentTime || 0);
  };

  // Update DSP filters instantly whenever react states change
  useEffect(() => {
    updateDspValues();
  }, [preamp, bass, mid, treble]);

  // ----------------------------------------------------
  // MUSIC PLAYER LOGIC
  // ----------------------------------------------------
  const handleFolderImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const loadedTracks: Track[] = [];
    let idCounter = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
        // Attempt to extract dummy track numbers from naming patterns (e.g., "01 - Song.mp3")
        const match = file.name.match(/^(\d+)/);
        const trackNo = match ? parseInt(match[1], 10) : 0;

        loadedTracks.push({
          id: idCounter++,
          title: file.name.replace(/\.[^/.]+$/, ""), // Strip file extension
          album: "Local Album",
          trackNo: trackNo,
          url: URL.createObjectURL(file) // Convert local file to playable browser URL
        });
      }
    }

    // Sort by track number automatically
    loadedTracks.sort((a, b) => a.trackNo - b.trackNo);
    setPlaylist(loadedTracks);
    if (loadedTracks.length > 0) setCurrentIdx(0);
  };

  const startTrackPipeline = (idx: number) => {
    setCurrentIdx(idx);
    setIsPlaying(true);

    // Initialize audio node context map on first interaction (Browser safety guardrail)
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    } else {
      initAudioGraph();
    }

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = playlist[idx].url;
        audioRef.current.play().catch(err => console.log("Playback interrupted: ", err));
      }
    }, 50);
  };

  const togglePlayState = () => {
    if (playlist.length === 0) return;
    if (currentIdx === -1) {
      startTrackPipeline(0);
      return;
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play();
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    if (currentIdx < playlist.length - 1) startTrackPipeline(currentIdx + 1);
  };

  const prevTrack = () => {
    if (currentIdx > 0) startTrackPipeline(currentIdx - 1);
  };

  return (
    <div className="flex flex-col h-screen bg-[#181825] text-[#cdd6f4] font-sans overflow-hidden selection:bg-[#313244]">
      {/* Hidden HTML5 Native Audio Anchor */}
      <audio ref={audioRef} onEnded={nextTrack} crossOrigin="anonymous" />

      {/* Main Core Viewport */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* --- SIDEBAR: DSP EQUALIZER PANEL --- */}
        <div className="w-72 bg-[#11111b] flex flex-col items-center py-6 px-4 border-r border-[#313244]">
          <div className="flex items-center gap-2 mb-8">
            <Sliders className="text-[#89b4fa]" size={24} />
            <h1 className="text-xl font-black tracking-wider text-white">QUELLQA DSP</h1>
          </div>

          {/* Pre-Amp Controls Container */}
          <div className="w-full px-4 mb-8">
            <div className="flex justify-between text-xs font-bold text-[#a6adc8] mb-2">
              <span>Pre-amp</span>
              <span className={preamp > 0 ? "text-[#f38ba8]" : "text-[#a6e3a1]"}>{preamp > 0 ? `+${preamp}` : preamp} dB</span>
            </div>
            <input 
              type="range" min="-12" max="12" step="0.5" value={preamp} 
              onChange={(e) => setPreamp(parseFloat(e.target.value))}
              className="w-full accent-[#89b4fa] bg-[#313244] h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* 3-Band Vertical Slider System */}
          <div className="flex justify-around items-stretch w-full flex-1 max-h-64 px-2 mt-4">
            {/* Bass Slider */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[10px] font-bold text-gray-400">{bass > 0 ? `+${bass}` : bass}</span>
              <input 
                type="range" min="-12" max="12" step="0.5" value={bass} orient="vertical"
                onChange={(e) => setBass(parseFloat(e.target.value))}
                className="accent-[#f38ba8] bg-[#313244] w-2 h-full rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
              />
              <span className="text-xs font-semibold text-center text-[#f38ba8]">BASS<br/><span className="text-[10px] text-gray-500">150Hz</span></span>
            </div>

            {/* Mids Slider */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[10px] font-bold text-gray-400">{mid > 0 ? `+${mid}` : mid}</span>
              <input 
                type="range" min="-12" max="12" step="0.5" value={mid} orient="vertical"
                onChange={(e) => setMid(parseFloat(e.target.value))}
                className="accent-[#fab387] bg-[#313244] w-2 h-full rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
              />
              <span className="text-xs font-semibold text-center text-[#fab387]">MIDS<br/><span className="text-[10px] text-gray-500">1kHz</span></span>
            </div>

            {/* Treble Slider */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[10px] font-bold text-gray-400">{treble > 0 ? `+${treble}` : treble}</span>
              <input 
                type="range" min="-12" max="12" step="0.5" value={treble} orient="vertical"
                onChange={(e) => setTreble(parseFloat(e.target.value))}
                className="accent-[#a6e3a1] bg-[#313244] w-2 h-full rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
              />
              <span className="text-xs font-semibold text-center text-[#a6e3a1]">TREBLE<br/><span className="text-[10px] text-gray-500">5kHz</span></span>
            </div>
          </div>
        </div>

        {/* --- MAIN PANEL: ALBUM & TRACKLIST STORAGE VIEW --- */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <label className="flex items-center gap-2 bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold px-4 py-2.5 rounded-lg cursor-pointer transition shadow-md">
              <FolderOpen size={18} />
              <span>Import</span>
              <input type="file" multiple accept="audio/*" onChange={handleFolderImport} className="hidden" />
            </label>
            <span className="text-xs font-mono text-[#585b70]">Quellqa Audio Engine {version}</span>
          </div>

          {/* Playlist Data Grid Table */}
          <div className="bg-[#1e1e2e] rounded-xl p-4 flex-1 border border-[#313244] overflow-y-auto">
            <div className="flex text-xs font-bold text-[#585b70] uppercase border-b border-[#313244] pb-2 px-4 mb-2">
              <div className="w-12">##</div>
              <div className="flex-1">Title</div>
              <div className="w-48">Album</div>
            </div>

            {playlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-[#585b70] gap-2">
                <Music size={32} />
                <p className="text-sm">No songs loaded. Import a folder to assemble a playlist.</p>
              </div>
            ) : (
              playlist.map((track, idx) => (
                <div 
                  key={track.id} 
                  onClick={() => startTrackPipeline(idx)}
                  className={`flex items-center text-sm py-3 px-4 rounded-lg cursor-pointer transition group ${
                    currentIdx === idx ? 'bg-[#313244] text-[#89b4fa]' : 'hover:bg-[#252538] text-[#cdd6f4]'
                  }`}
                >
                  <div className="w-12 font-mono text-[#585b70] group-hover:text-[#89b4fa]">
                    {currentIdx === idx && isPlaying ? "🔊" : String(track.trackNo || idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 font-medium truncate pr-4">{track.title}</div>
                  <div className="w-48 text-[#585b70] truncate group-hover:text-[#a6adc8]">{track.album}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- LOWER CONTROL FOOTER BAR --- */}
      <div className="h-24 bg-[#11111b] border-t border-[#313244] flex items-center justify-between px-8 z-10">
        {/* Track Detail Field (Left) */}
        <div className="flex items-center gap-3 w-1/3">
          {currentIdx !== -1 ? (
            <>
              <div className="p-2.5 bg-[#1e1e2e] rounded-lg text-[#89b4fa] animate-spin [animation-duration:8s]">
                <Disc size={24} />
              </div>
              <div className="overflow-hidden">
                <h3 className="text-sm font-bold text-white truncate">{playlist[currentIdx]?.title}</h3>
                <p className="text-xs text-[#585b70] truncate">{playlist[currentIdx]?.album}</p>
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold text-[#585b70]">No active session</p>
          )}
        </div>

        {/* Playback Buttons Control Strip (Center) */}
        <div className="flex items-center gap-4">
          <button onClick={prevTrack} disabled={currentIdx <= 0} className="text-[#a6adc8] hover:text-white disabled:opacity-30 disabled:hover:text-[#a6adc8] transition">
            <SkipBack size={22} />
          </button>
          
          <button 
            onClick={togglePlayState}
            className="p-3 rounded-full bg-[#89b4fa] text-[#11111b] hover:scale-105 active:scale-95 transition shadow-lg"
          >
            {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
          </button>

          <button onClick={nextTrack} disabled={currentIdx === -1 || currentIdx >= playlist.length - 1} className="text-[#a6adc8] hover:text-white disabled:opacity-30 disabled:hover:text-[#a6adc8] transition">
            <SkipForward size={22} />
          </button>
        </div>

        {/* Structural Balancing Deadzone spacer */}
        <div className="w-1/3 flex justify-end text-xs font-mono text-[#585b70]">
          WebAudio API Node Graph Active
        </div>
      </div>
    </div>
  );
}
