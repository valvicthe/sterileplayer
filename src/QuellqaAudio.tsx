import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Heart, Sparkles, FolderPlus, Disc, Volume2, X, Minus } from 'lucide-react';
import * as musicMetadata from 'music-metadata-browser';

interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  trackNo: number;
  url: string;
  coverArt: string;
}

export default function QuellqaAudio() {
  const version = "v1.3.0-Boutique";
  
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // Custom tuned aggressive ear-shattering DSP parameters
  const [preamp, setPreamp] = useState<number>(-2);
  const [bass, setBass] = useState<number>(8); // Pure heavy analog rumble
  const [mid, setMid] = useState<number>(-3);
  const [treble, setTreble] = useState<number>(5); // Sharp presence

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const preampNodeRef = useRef<GainNode | null>(null);
  const bassNodeRef = useRef<BiquadFilterNode | null>(null);
  const midNodeRef = useRef<BiquadFilterNode | null>(null);
  const trebleNodeRef = useRef<BiquadFilterNode | null>(null);

  useEffect(() => {
    if (currentIdx !== -1 && playlist[currentIdx]) {
      document.title = `🌸 ${playlist[currentIdx].title} — Quellqa`;
    } else {
      document.title = `Quellqa Audio`;
    }
  }, [currentIdx, playlist]);

  const closeWindow = () => {
    try { const { ipcRenderer } = window.require('electron'); ipcRenderer.send('window-control', 'close'); } catch(e){}
  };
  const minimizeWindow = () => {
    try { const { ipcRenderer } = window.require('electron'); ipcRenderer.send('window-control', 'minimize'); } catch(e){}
  };

  const initAudioGraph = () => {
    if (!audioRef.current || audioCtxRef.current) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);
    sourceRef.current = source;

    const preampNode = ctx.createGain();
    const bassNode = ctx.createBiquadFilter();
    const midNode = ctx.createBiquadFilter();
    const trebleNode = ctx.createBiquadFilter();

    bassNode.type = 'lowshelf';
    bassNode.frequency.value = 160;

    midNode.type = 'peaking';
    midNode.Q.value = 1.4;
    midNode.frequency.value = 1100;

    trebleNode.type = 'highshelf';
    trebleNode.frequency.value = 4200;

    source.connect(preampNode);
    preampNode.connect(bassNode);
    bassNode.connect(midNode);
    midNode.connect(trebleNode);
    trebleNode.connect(ctx.destination);

    preampNodeRef.current = preampNode;
    bassNodeRef.current = bassNode;
    midNodeRef.current = midNode;
    trebleNodeRef.current = trebleNode;

    updateDspValues();
  };

  const updateDspValues = () => {
    if (preampNodeRef.current) {
      const gainLinear = Math.pow(10, preamp / 20);
      preampNodeRef.current.gain.setValueAtTime(gainLinear, audioCtxRef.current?.currentTime || 0);
    }
    if (bassNodeRef.current) bassNodeRef.current.gain.setValueAtTime(bass, audioCtxRef.current?.currentTime || 0);
    if (midNodeRef.current) midNodeRef.current.gain.setValueAtTime(mid, audioCtxRef.current?.currentTime || 0);
    if (trebleNodeRef.current) trebleNodeRef.current.gain.setValueAtTime(treble, audioCtxRef.current?.currentTime || 0);
  };

  useEffect(() => { updateDspValues(); }, [preamp, bass, mid, treble]);

  const handleFolderImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const loadedTracks: Track[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav')) {
        try {
          const metadata = await musicMetadata.parseBlob(file);
          const common = metadata.common;
          let coverArtUrl = "";
          if (common.picture && common.picture.length > 0) {
            const pic = common.picture[0];
            const base64String = btoa(new Uint8Array(pic.data).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            coverArtUrl = `data:${pic.format};base64,${base64String}`;
          }
          loadedTracks.push({
            id: i,
            title: common.title || file.name.replace(/\.[^/.]+$/, ""),
            artist: common.artist || "Unknown Cutie",
            album: common.album || "Single Piece",
            trackNo: common.track.no || i + 1,
            url: URL.createObjectURL(file),
            coverArt: coverArtUrl
          });
        } catch (err) {
          loadedTracks.push({
            id: i,
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "Unknown Cutie",
            album: "Single Piece",
            trackNo: i + 1,
            url: URL.createObjectURL(file),
            coverArt: ""
          });
        }
      }
    }
    loadedTracks.sort((a, b) => a.trackNo - b.trackNo);
    setPlaylist(loadedTracks);
    if (loadedTracks.length > 0) setCurrentIdx(0);
  };

  const startTrackPipeline = (idx: number) => {
    setCurrentIdx(idx);
    setIsPlaying(true);
    if (audioCtxRef.current?.state === 'suspended') { audioCtxRef.current.resume(); } else { initAudioGraph(); }

    const track = playlist[idx];
    try {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('update-rpc', { title: track.title, artist: track.artist, album: track.album, isPlaying: true });
    } catch (e) {}

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.play().catch(err => console.log(err));
      }
    }, 50);
  };

  const togglePlayState = () => {
    if (playlist.length === 0) return;
    if (currentIdx === -1) { startTrackPipeline(0); return; }
    const track = playlist[currentIdx];
    let nextPlayState = !isPlaying;

    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); }
    else { audioRef.current?.play(); setIsPlaying(true); }

    try {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('update-rpc', { title: track.title, artist: track.artist, album: track.album, isPlaying: nextPlayState });
    } catch (e) {}
  };

  return (
    <div className="flex flex-col h-screen bg-[#fffcfd] text-[#2d1e30] overflow-hidden antialiased">
      <audio ref={audioRef} onEnded={() => { if (currentIdx < playlist.length - 1) startTrackPipeline(currentIdx + 1); }} crossOrigin="anonymous" />

      {/* 🎀 CUSTOM HIGH-END DESIGNER TITLEBAR */}
      <div className="h-10 bg-[#ffaec1] border-b-2 border-[#ff9cb4] flex items-center justify-between px-4 titlebar-drag select-none shrink-0 z-50">
        {/* Mac-style Window Dot Actions */}
        <div className="flex items-center gap-2 titlebar-nodrag">
          <button onClick={closeWindow} className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] hover:bg-[#ff4a40] flex items-center justify-center transition group border border-black/10">
            <X size={8} className="text-black/40 opacity-0 group-hover:opacity-100 transition" />
          </button>
          <button onClick={minimizeWindow} className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] hover:bg-[#ffac1c] flex items-center justify-center transition group border border-black/10">
            <Minus size={8} className="text-black/40 opacity-0 group-hover:opacity-100 transition" />
          </button>
          <div className="w-3.5 h-3.5 rounded-full bg-[#27c93f] opacity-40 border border-black/10" />
        </div>

        {/* Dynamic Center Engine Title badge */}
        <div className="text-[11px] font-black tracking-widest text-[#4a2e37] uppercase bg-white/40 px-4 py-0.5 rounded-full border border-white/40">
          {currentIdx !== -1 ? `🍭 playing: ${playlist[currentIdx].title}` : '✨ QUELLQA DECK DEVIATION ✨'}
        </div>

        <div className="text-[10px] font-mono font-bold text-[#6e4651] pr-2">
          {version}
        </div>
      </div>

      {/* MAIN CONTENT SPLIT LAYER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* 🎛️ ASYMMETRICAL BOUTIQUE AUDIO ENGINE PANEL */}
        <div className="w-80 bg-[#fff5f7] flex flex-col py-6 px-5 border-r-2 border-[#ffdae0] justify-between">
          
          {/* Header branding block */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#a88691] bg-[#ffeaee] px-2 py-0.5 rounded-md">Boutique Hardware</span>
              <Heart size={14} className="text-[#ff4d79]" fill="currentColor" />
            </div>
            <h2 className="text-2xl font-black tracking-tighter text-[#3a1d28] leading-none mb-1">Analog EQ</h2>
            <p className="text-[11px] text-[#91757f] font-medium leading-tight">High-precision IIR filters mapped to hardware constraints.</p>
          </div>

          {/* 3-Band Equalizer Deck Configuration */}
          <div className="my-auto bg-white rounded-3xl p-5 border-2 border-[#ffdae0] shadow-[0_8px_24px_rgba(255,218,224,0.3)] flex justify-between items-stretch h-56">
            {/* Bass slider assembly */}
            <div className="flex flex-col items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#ff4d79] bg-[#fff0f3] w-9 text-center py-0.5 rounded-md border border-[#ffcad4]">{bass > 0 ? `+${bass}` : bass}</span>
              <div className="h-36 py-2 flex justify-center items-center">
                <input 
                  type="range" min="-12" max="12" step="0.5" value={bass} orient="vertical"
                  onChange={(e) => setBass(parseFloat(e.target.value))}
                  className="kawaii-slider kawaii-slider-vertical"
                />
              </div>
              <span className="text-[10px] font-black tracking-tight text-[#ff4d79] uppercase">Sub-Bass</span>
            </div>

            {/* Mids slider assembly */}
            <div className="flex flex-col items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#ff8736] bg-[#fff5ee] w-9 text-center py-0.5 rounded-md border border-[#ffe0cc]">{mid > 0 ? `+${mid}` : mid}</span>
              <div className="h-36 py-2 flex justify-center items-center">
                <input 
                  type="range" min="-12" max="12" step="0.5" value={mid} orient="vertical"
                  onChange={(e) => setMid(parseFloat(e.target.value))}
                  className="kawaii-slider kawaii-slider-vertical accent-[#ff8736]"
                />
              </div>
              <span className="text-[10px] font-black tracking-tight text-[#ff8736] uppercase">Mids</span>
            </div>

            {/* Treble slider assembly */}
            <div className="flex flex-col items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#32c499] bg-[#eefffb] w-9 text-center py-0.5 rounded-md border border-[#ccfff4]">{treble > 0 ? `+${treble}` : treble}</span>
              <div className="h-36 py-2 flex justify-center items-center">
                <input 
                  type="range" min="-12" max="12" step="0.5" value={treble} orient="vertical"
                  onChange={(e) => setTreble(parseFloat(e.target.value))}
                  className="kawaii-slider kawaii-slider-vertical accent-[#32c499]"
                />
              </div>
              <span className="text-[10px] font-black tracking-tight text-[#32c499] uppercase">Presence</span>
            </div>
          </div>

          {/* Master Pre-amp safety floor controller */}
          <div className="bg-white rounded-2xl p-3 border border-[#ffdae0]">
            <div className="flex justify-between text-[10px] font-black text-[#695058] mb-1.5 uppercase tracking-wide">
              <div className="flex items-center gap-1"><Volume2 size={12}/><span>System Headroom</span></div>
              <span className="font-mono">{preamp} dB</span>
            </div>
            <input 
              type="range" min="-12" max="12" step="0.5" value={preamp} 
              onChange={(e) => setPreamp(parseFloat(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-[#fff0f2] cursor-pointer accent-[#ff4d79] kawaii-slider"
            />
          </div>
        </div>

        {/* 🎵 ALBUM LOADER VIEWPORT & TRACKLIST COMPARTMENT */}
        <div className="flex-1 flex flex-col p-6 bg-[#fffcfd]">
          
          {/* Action Trigger Row */}
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-xs font-black tracking-wider uppercase text-[#a3808c]">Acoustic Library</h3>
              <p className="text-lg font-black text-[#2e151f]">Loaded Tracks</p>
            </div>
            <label className="flex items-center gap-2 bg-[#1f1522] hover:bg-[#322436] text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition shadow-md border-b-2 border-black">
              <FolderPlus size={14} className="text-[#ff9cb4]" />
              <span>Import Audio Album</span>
              <input type="file" multiple accept="audio/*" onChange={handleFolderImport} className="hidden" />
            </label>
          </div>

          {/* Asymmetric Offset Track Window */}
          <div className="flex-1 bg-white rounded-[32px] border-2 border-[#ffdae0] p-4 overflow-y-auto shadow-sm">
            {playlist.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#9c7d87] gap-3">
                <div className="w-12 h-12 bg-[#fff0f3] border border-[#ffcad4] rounded-2xl flex items-center justify-center text-[#ff4d79]">
                  <Sparkles size={20} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-wider text-[#ff4d79] mb-0.5">Player is Empty</p>
                  <p className="text-[11px] font-medium text-gray-400">Load local directories to populate audio pipelines.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {playlist.map((track, idx) => (
                  <div 
                    key={track.id}
                    onClick={() => startTrackPipeline(idx)}
                    className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition group border ${
                      currentIdx === idx 
                        ? 'bg-[#ffebf0] border-[#ffb8c7] text-[#ff4d79]' 
                        : 'bg-transparent border-transparent hover:bg-[#fff2f4] text-[#422e37]'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${currentIdx === idx ? 'bg-[#ff4d79] text-white' : 'bg-[#fff0f2] text-[#ff809d]'}`}>
                        {currentIdx === idx && isPlaying ? "⚡" : String(track.trackNo).padStart(2, '0')}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-bold truncate text-xs">{track.title}</div>
                        <div className="text-[10px] text-gray-400 font-bold truncate group-hover:text-[#ff8ca4]">{track.artist}</div>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 opacity-60 max-w-[120px] truncate pr-2">{track.album}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🌸 LOWER CONSOLE PLAYER DECK STRIP */}
      <div className="h-24 bg-white border-t-2 border-[#ffdae0] flex items-center justify-between px-6 shrink-0 shadow-inner z-10">
        
        {/* Vinyl artwork spinner card */}
        <div className="w-1/3 flex items-center gap-3">
          {currentIdx !== -1 ? (
            <>
              <div className="relative shrink-0">
                {playlist[currentIdx]?.coverArt ? (
                  <img 
                    src={playlist[currentIdx].coverArt} 
                    alt="art" 
                    className={`w-14 h-14 rounded-2xl object-cover border border-[#ffb3c1] shadow-sm ${isPlaying ? 'animate-spin [animation-duration:10s]' : ''}`} 
                  />
                ) : (
                  <div className="w-14 h-14 bg-[#fff0f2] border border-[#ffcad4] rounded-2xl flex items-center justify-center text-[#ff4d79]">
                    <Disc size={20} className={isPlaying ? 'animate-spin [animation-duration:5s]' : ''} />
                  </div>
                )}
                <div className="absolute inset-0 m-auto w-3 h-3 bg-white border border-[#ffb3c1] rounded-full shadow-inner" />
              </div>
              <div className="overflow-hidden leading-tight">
                <div className="text-xs font-black text-[#2e1b23] truncate">{playlist[currentIdx]?.title}</div>
                <div className="text-[11px] text-[#ff4d79] font-black truncate">{playlist[currentIdx]?.artist}</div>
                <div className="text-[9px] font-mono font-bold text-gray-400 tracking-wider uppercase truncate mt-0.5">💿 {playlist[currentIdx]?.album}</div>
              </div>
            </>
          ) : (
            <div className="text-[11px] font-bold text-[#b8a0aa] tracking-wide flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ffccd5] animate-ping" />
              <span>Awaiting input sequence...</span>
            </div>
          )}
        </div>

        {/* Center operational navigation deck */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { if (currentIdx > 0) startTrackPipeline(currentIdx - 1); }} 
            disabled={currentIdx <= 0} 
            className="w-9 h-9 rounded-xl border border-[#ffdae0] flex items-center justify-center text-[#ff9cb2] hover:text-[#ff4d79] hover:bg-[#fff2f5] disabled:opacity-20 disabled:hover:bg-transparent transition active:scale-90"
          >
            <SkipBack size={16} fill="currentColor" />
          </button>
          
          <button 
            onClick={togglePlayState}
            className="w-12 h-12 rounded-2xl bg-[#ff4d79] hover:bg-[#ff2458] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(255,77,121,0.4)] transition transform hover:scale-105 active:scale-95 border-b-2 border-[#b81d43]"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>

          <button 
            onClick={() => { if (currentIdx < playlist.length - 1) startTrackPipeline(currentIdx + 1); }} 
            disabled={currentIdx === -1 || currentIdx >= playlist.length - 1} 
            className="w-9 h-9 rounded-xl border border-[#ffdae0] flex items-center justify-center text-[#ff9cb2] hover:text-[#ff4d79] hover:bg-[#fff2f5] disabled:opacity-20 disabled:hover:bg-transparent transition active:scale-90"
          >
            <SkipForward size={16} fill="currentColor" />
          </button>
        </div>

        {/* Status loop counter right flank */}
        <div className="w-1/3 flex justify-end text-[10px] font-mono text-[#a38c94] tracking-wider uppercase font-bold">
          {playlist.length > 0 ? `Track [ ${currentIdx + 1} / ${playlist.length} ]` : 'Empty Rack'}
        </div>
      </div>
    </div>
  );
}
