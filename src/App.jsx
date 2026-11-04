import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { 
  Monitor, 
  Plus, 
  Trash2, 
  Clock, 
  Lock, 
  MapPin, 
  Sliders, 
  Eye, 
  ArrowRight, 
  ArrowLeft, 
  X 
} from 'lucide-react';

// Room Master Data & Floor / Orientation Mappings
const ROOM_METADATA = {
  'Phoenix': { floor: '1st Floor', floorCode: '1st', side: 'left' },
  'Parrot': { floor: '1st Floor', floorCode: '1st', side: 'right' },
  'Flamingo': { floor: '2nd Floor', floorCode: '2nd', side: 'left' },
  'Flamingo 1&2': { floor: '2nd Floor', floorCode: '2nd', side: 'left' },
  'Flamingo 3&4': { floor: '2nd Floor', floorCode: '2nd', side: 'left' },
  'Toucan': { floor: '2nd Floor', floorCode: '2nd', side: 'right' },
  'Pavio Theatre': { floor: 'LGF', floorCode: 'LGF', side: 'left' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('cms');
  const [selectedScreen, setSelectedScreen] = useState('gf_lobby');
  const [movableFloorSetting, setMovableFloorSetting] = useState('2nd Floor');
  
  // Schedule & Event State (Synced with Supabase)
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulatedTime, setSimulatedTime] = useState('11:00');
  const [forceVideoLoop, setForceVideoLoop] = useState(false);
  
  // Security Lockdown State
  const [isTouchLocked, setIsTouchLocked] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    room: 'Phoenix',
    targets: ['lgf_lobby', 'gf_lobby', 'floor_movable'],
    startTime: '09:00',
    endTime: '17:00',
    headerOverride: ''
  });

  // URL Query Params handling for physical displays
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const screenParam = params.get('screen');

    if (modeParam === 'player') setActiveTab('player');
    if (screenParam) setSelectedScreen(screenParam);
  }, []);

  // Fetch initial events & subscribe to live Supabase updates
  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      const formatted = data.map(item => ({
        id: item.id,
        title: item.title,
        room: item.room,
        floor: item.floor,
        targets: item.targets || [],
        startTime: item.start_time,
        endTime: item.end_time,
        headerOverride: item.header_override || ''
      }));
      setEvents(formatted);
    }
    setLoading(false);
  };

  // Calculate Active Events based on simulated clock
  const activeEventsForScreen = useMemo(() => {
    if (forceVideoLoop) return [];
    
    return events.filter(evt => {
      const isTargeted = evt.targets.includes(selectedScreen);
      const isWithinTime = simulatedTime >= evt.startTime && simulatedTime <= evt.endTime;
      return isTargeted && isWithinTime;
    }).slice(0, 4);
  }, [events, selectedScreen, simulatedTime, forceVideoLoop]);

  // Touch Lockdown TAP Handler (5 taps top right)
  const handleCornerTap = () => {
    if (!isTouchLocked) return;
    const nextCount = tapCount + 1;
    setTapCount(nextCount);
    if (nextCount >= 5) {
      setShowPinModal(true);
      setTapCount(0);
    }
    setTimeout(() => setTapCount(0), 3000);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === '0000') {
      setIsTouchLocked(false);
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!formData.title) return;
    
    const roomMeta = ROOM_METADATA[formData.room] || { floor: '1st Floor' };
    const newId = `evt-${Date.now()}`;

    const { error } = await supabase.from('events').insert([
      {
        id: newId,
        title: formData.title,
        room: formData.room,
        floor: roomMeta.floor,
        targets: formData.targets,
        start_time: formData.startTime,
        end_time: formData.endTime,
        header_override: formData.headerOverride
      }
    ]);

    if (error) {
      console.error('Error inserting event:', error);
      alert('Failed to add event to Supabase');
      return;
    }

    setFormData({
      title: '',
      room: 'Phoenix',
      targets: ['lgf_lobby', 'gf_lobby', 'floor_movable'],
      startTime: '09:00',
      endTime: '17:00',
      headerOverride: ''
    });
  };

  const handleDeleteEvent = async (id) => {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) {
      console.error('Error deleting event:', error);
    }
  };

  const getHeaderTitle = () => {
    if (activeEventsForScreen.length === 0) return '';
    if (activeEventsForScreen[0].headerOverride) return activeEventsForScreen[0].headerOverride;
    if (activeEventsForScreen.length === 1) return activeEventsForScreen[0].title;
    return "Today's Events";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col w-full overflow-x-hidden">
      {/* Top Global Mode Switcher Bar (Fully Responsive Wrap) */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 z-50 w-full">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-serif font-bold text-base tracking-wider">
              voco
            </div>
            <div>
              <h1 className="font-semibold text-xs md:text-sm text-slate-200">Signage System Controller</h1>
              <p className="text-[10px] md:text-xs text-slate-400">Beirut Central District</p>
            </div>
          </div>

          {/* View Mode Toggle Buttons (Mobile Inline) */}
          <div className="flex md:hidden items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('cms')}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${
                activeTab === 'cms' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              CMS
            </button>
            <button
              onClick={() => setActiveTab('player')}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${
                activeTab === 'player' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Player
            </button>
          </div>
        </div>

        {/* View Mode Toggle Buttons (Desktop) */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('cms')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'cms' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Staff CMS Admin</span>
          </button>
          <button
            onClick={() => setActiveTab('player')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'player' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Signage Player Display</span>
          </button>
        </div>

        {/* Hardware Simulator Controls (Flexible Wrap Grid on Mobile) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex-1 sm:flex-initial flex items-center justify-between space-x-1.5 text-xs bg-slate-950 px-2.5 py-1.5 rounded-md border border-slate-800">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400 text-[11px]">Time:</span>
            </div>
            <input
              type="time"
              value={simulatedTime}
              onChange={(e) => setSimulatedTime(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-amber-400 text-xs px-1.5 py-0.5 rounded focus:outline-none"
            />
          </div>

          <div className="flex-1 sm:flex-initial flex items-center justify-between space-x-1.5 text-xs bg-slate-950 px-2.5 py-1.5 rounded-md border border-slate-800">
            <div className="flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400 text-[11px]">Screen:</span>
            </div>
            <select
              value={selectedScreen}
              onChange={(e) => setSelectedScreen(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs px-1.5 py-0.5 rounded focus:outline-none max-w-[130px] sm:max-w-none"
            >
              <option value="gf_lobby">GF Lobby Screen</option>
              <option value="lgf_lobby">LGF Lobby Screen</option>
              <option value="floor_movable">Floor Directional Signage</option>
            </select>
          </div>

          {selectedScreen === 'floor_movable' && (
            <div className="flex-1 sm:flex-initial flex items-center justify-between space-x-1.5 text-xs bg-slate-950 px-2.5 py-1.5 rounded-md border border-slate-800">
              <span className="text-slate-400 text-[11px]">Floor:</span>
              <select
                value={movableFloorSetting}
                onChange={(e) => setMovableFloorSetting(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-amber-400 text-xs px-1.5 py-0.5 rounded focus:outline-none"
              >
                <option value="1st Floor">1st Floor</option>
                <option value="2nd Floor">2nd Floor</option>
              </select>
            </div>
          )}
        </div>
      </header>

      {/* CMS ADMIN CONTROLLER TAB */}
      {activeTab === 'cms' && (
        <div className="flex-1 p-3 md:p-6 flex flex-col lg:grid lg:grid-cols-12 gap-6 overflow-y-auto w-full">
          {/* Left Panel: Event Form and Schedule List */}
          <div className="w-full lg:col-span-5 space-y-4 md:space-y-6">
            {/* Add Event Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="font-semibold text-xs md:text-sm flex items-center space-x-2 text-slate-200">
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Schedule New Event</span>
                </h2>
                <span className="text-[10px] md:text-xs text-emerald-400/80 bg-emerald-400/10 px-2 py-0.5 rounded flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Supabase Live</span>
                </span>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-3 md:space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Event Name / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Saccal Meeting, Unicef CPD..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Meeting Room</label>
                    <select
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      {Object.keys(ROOM_METADATA).map(room => (
                        <option key={room} value={room}>{room} ({ROOM_METADATA[room].floor})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Custom Header Override</label>
                    <input
                      type="text"
                      placeholder="Optional title override"
                      value={formData.headerOverride}
                      onChange={(e) => setFormData({ ...formData, headerOverride: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">End Time</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Target Displays</label>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'gf_lobby', label: 'GF Lobby' },
                      { id: 'lgf_lobby', label: 'LGF Lobby' },
                      { id: 'floor_movable', label: 'Floor' },
                    ].map(target => (
                      <label key={target.id} className="flex items-center space-x-1.5 cursor-pointer bg-slate-950 border border-slate-800 p-2 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={formData.targets.includes(target.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, targets: [...formData.targets, target.id] });
                            } else {
                              setFormData({ ...formData, targets: formData.targets.filter(t => t !== target.id) });
                            }
                          }}
                          className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 bg-slate-950"
                        />
                        <span className="text-slate-300 truncate">{target.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-2.5 rounded transition flex items-center justify-center space-x-2 text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publish Schedule</span>
                </button>
              </form>
            </div>

            {/* Active Schedule List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-3">
              <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">
                Active Schedules ({events.length})
              </h3>
              {loading ? (
                <p className="text-xs text-slate-500">Syncing with database...</p>
              ) : events.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No events scheduled in database.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {events.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{evt.title}</div>
                        <div className="text-amber-400/90 text-[11px]">
                          in {evt.room} • ({evt.startTime} - {evt.endTime})
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Live Canvas Simulator (Auto-scaling aspect ratio on mobile) */}
          <div className="w-full lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-xs md:text-sm text-slate-200">Live Hardware Canvas Emulator</h3>
              </div>
              <button
                onClick={() => setForceVideoLoop(!forceVideoLoop)}
                className={`px-2.5 py-1 rounded border text-[11px] transition ${
                  forceVideoLoop
                    ? 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {forceVideoLoop ? 'Force Promo' : 'Schedule Mode'}
              </button>
            </div>

            {/* Scaled Responsive Display Box */}
            <div className="w-full flex justify-center items-center py-2 overflow-hidden">
              <div className={`w-full max-w-sm md:max-w-md ${
                selectedScreen === 'floor_movable' ? 'aspect-[16/9]' : 'aspect-[9/16]'
              } bg-black rounded-lg overflow-hidden border-2 border-slate-800 relative shadow-2xl flex items-center justify-center max-h-[65vh]`}>
                <SignageCanvas
                  selectedScreen={selectedScreen}
                  movableFloorSetting={movableFloorSetting}
                  activeEvents={activeEventsForScreen}
                  headerTitle={getHeaderTitle()}
                  isTouchLocked={isTouchLocked}
                  onCornerTap={handleCornerTap}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PLAYER DISPLAY TAB */}
      {activeTab === 'player' && (
        <div className="flex-1 bg-black relative overflow-hidden flex flex-col w-full h-full">
          <SignageCanvas
            selectedScreen={selectedScreen}
            movableFloorSetting={movableFloorSetting}
            activeEvents={activeEventsForScreen}
            headerTitle={getHeaderTitle()}
            isTouchLocked={isTouchLocked}
            onCornerTap={handleCornerTap}
          />
        </div>
      )}

      {/* Security PIN Override Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl w-full max-w-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Admin Touch Bypass</span>
              </h3>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">Enter security PIN to unlock touch controls on this display.</p>
            <form onSubmit={handlePinSubmit} className="space-y-3">
              <input
                type="password"
                maxLength={4}
                placeholder="PIN (Default 0000)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-center text-lg tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
              />
              {pinError && <p className="text-[11px] text-red-400 text-center">Incorrect PIN. Try 0000.</p>}
              <button
                type="submit"
                className="w-full bg-amber-500 text-slate-950 font-semibold py-2 rounded text-xs hover:bg-amber-400 transition"
              >
                Unlock Screen
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-Component: Signage Canvas Renderer
function SignageCanvas({
  selectedScreen,
  movableFloorSetting,
  activeEvents,
  headerTitle,
  isTouchLocked,
  onCornerTap
}) {
  if (activeEvents.length === 0) {
    return (
      <div 
        className={`w-full h-full bg-slate-950 relative flex flex-col items-center justify-center p-4 ${
          isTouchLocked ? 'pointer-events-auto' : ''
        }`}
      >
        <div
          onClick={onCornerTap}
          className="aria-hidden:true absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 z-50 cursor-default"
        />

        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 opacity-90" />
        <div className="relative z-10 text-center space-y-3">
          <div className="inline-block bg-amber-400/10 border border-amber-400/30 text-amber-400 font-serif text-2xl md:text-3xl px-5 py-1.5 rounded-lg tracking-widest">
            voco
          </div>
          <h2 className="text-base md:text-xl font-serif text-slate-300 tracking-wide">Beirut Central District</h2>
          <p className="text-[10px] md:text-xs text-slate-500 animate-pulse">Playing Hotel Promo Video Loop...</p>
        </div>

        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center">
          <div className="text-center font-serif text-[10px] md:text-xs text-slate-400 tracking-widest border-t border-slate-800/80 pt-2 px-6">
            <span className="text-amber-400 font-bold">VOCO</span> BEIRUT CENTRAL DISTRICT
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`w-full h-full bg-[#070B19] text-white flex flex-col justify-between p-4 md:p-8 relative overflow-hidden select-none font-serif ${
        isTouchLocked ? 'pointer-events-none' : ''
      }`}
    >
      <div
        onClick={onCornerTap}
        className="pointer-events-auto absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 z-50 cursor-default"
      />

      <div className="text-center space-y-1 pt-1 z-10">
        <div className="flex items-center justify-center space-x-2 text-amber-400/90 text-[10px] md:text-xs tracking-widest uppercase font-sans">
          <span className="h-[1px] w-8 md:w-12 bg-amber-400/40" />
          <span>How To Get To</span>
          <span className="h-[1px] w-8 md:w-12 bg-amber-400/40" />
        </div>
        <h1 className="text-xl md:text-4xl font-bold text-white tracking-wide pt-0.5 line-clamp-2">
          {headerTitle}
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-center my-2 z-10 overflow-y-auto">
        {selectedScreen === 'floor_movable' ? (
          <FloorAxisLayout movableFloorSetting={movableFloorSetting} events={activeEvents} />
        ) : (
          <LobbyVerticalLayout screenType={selectedScreen} events={activeEvents} />
        )}
      </div>

      <div className="text-center z-10 border-t border-amber-400/20 pt-2 pb-0.5">
        <div className="inline-flex items-center space-x-2 text-[10px] md:text-xs text-slate-300 tracking-widest font-sans">
          <span className="font-serif font-bold text-amber-400 text-xs md:text-sm">voco</span>
          <span className="text-slate-400">|</span>
          <span>Beirut Central District</span>
        </div>
      </div>
    </div>
  );
}

function LobbyVerticalLayout({ screenType, events }) {
  const originBadge = screenType === 'lgf_lobby' ? 'LGF' : 'GF';

  return (
    <div className="w-full max-w-4xl space-y-2 md:space-y-4">
      {events.map((evt) => {
        const roomMeta = ROOM_METADATA[evt.room] || { floorCode: '1st' };
        const isFirstFloor = roomMeta.floorCode === '1st';

        return (
          <div key={evt.id} className="flex items-center justify-between space-x-2 md:space-x-6">
            <div className="bg-amber-400 text-slate-950 font-sans font-extrabold text-sm md:text-xl px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl shadow-lg shrink-0">
              {originBadge}
            </div>

            <div className="flex-1 flex items-center space-x-1 md:space-x-3 text-amber-400 font-sans text-[10px] md:text-xs min-w-0">
              {isFirstFloor ? (
                <div className="flex items-center space-x-1.5 md:space-x-3 w-full">
                  <div className="flex flex-col items-center space-y-0.5 shrink-0">
                    <div className="border border-amber-400/60 rounded p-0.5">
                      <div className="text-[9px] text-center font-mono">↑↓</div>
                    </div>
                  </div>
                  <div className="h-6 w-[1px] bg-amber-400/40 shrink-0" />
                  <div className="flex-1 border-t border-amber-400/40 flex items-center justify-between text-[9px] md:text-[11px] tracking-wider px-1 truncate">
                    <span className="truncate">ELEVATOR & STAIRS</span>
                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-amber-400 shrink-0 ml-1" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 md:space-x-3 w-full">
                  <div className="border border-amber-400/60 rounded p-0.5 shrink-0">
                    <div className="text-[9px] text-center font-mono">↑↓</div>
                  </div>
                  <div className="flex-1 border-t border-amber-400/40 flex items-center justify-between text-[9px] md:text-[11px] tracking-wider px-1 truncate">
                    <span className="truncate">ELEVATOR TO</span>
                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-amber-400 shrink-0 ml-1" />
                  </div>
                </div>
              )}
            </div>

            <div className="w-36 md:w-72 bg-[#0C142A] border md:border-2 border-amber-400/80 rounded-xl md:rounded-2xl p-2 md:p-4 text-center shadow-xl space-y-0.5 shrink-0">
              <div className="text-amber-400 font-serif text-xs md:text-lg font-bold">
                {roomMeta.floorCode} Floor
              </div>
              <div className="text-white font-serif text-xs md:text-base font-bold leading-tight truncate">
                {evt.title}
              </div>
              <div className="text-amber-300/90 font-serif text-[10px] md:text-xs italic truncate">
                in {evt.room}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FloorAxisLayout({ movableFloorSetting, events }) {
  const leftEvents = events.filter(e => (ROOM_METADATA[e.room]?.side || 'left') === 'left');
  const rightEvents = events.filter(e => (ROOM_METADATA[e.room]?.side || 'left') === 'right');

  return (
    <div className="w-full max-w-5xl space-y-4 md:space-y-12">
      <div className="relative flex items-center justify-between my-2 md:my-8">
        <div className="absolute inset-x-0 top-1/2 h-[2px] bg-amber-400/80 -translate-y-1/2" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 md:w-3 md:h-3 bg-amber-400 rounded-full" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 md:w-3 md:h-3 bg-amber-400 rounded-full" />

        <div className="relative z-10 mx-auto bg-[#070B19] px-4 text-center space-y-0.5">
          <div className="text-amber-400 font-serif text-sm md:text-2xl font-bold">
            {movableFloorSetting}
          </div>
          <div className="w-2 h-2 md:w-3 md:h-3 bg-amber-400 rounded-full mx-auto shadow-lg shadow-amber-400/50" />
          <div className="text-slate-300 font-sans text-[9px] md:text-xs tracking-wider flex items-center justify-center space-x-1 pt-0.5">
            <span>← You are here</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:gap-12 pt-1 md:pt-4">
        <div className="space-y-2 md:space-y-4">
          {leftEvents.map(evt => (
            <div key={evt.id} className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-white font-serif text-xs md:text-base font-bold truncate">{evt.title}</div>
                <div className="text-amber-400 font-serif text-[10px] md:text-xs italic truncate">in {evt.room}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 md:space-y-4 text-right">
          {rightEvents.map(evt => (
            <div key={evt.id} className="flex items-center justify-end space-x-2">
              <div className="min-w-0">
                <div className="text-white font-serif text-xs md:text-base font-bold truncate">{evt.title}</div>
                <div className="text-amber-400 font-serif text-[10px] md:text-xs italic truncate">in {evt.room}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}