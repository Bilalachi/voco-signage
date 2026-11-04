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
  ArrowRight, 
  ArrowLeft, 
  X,
  LogOut,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';

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
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App Main State
  const [activeTab, setActiveTab] = useState('cms');
  const [selectedScreen, setSelectedScreen] = useState('gf_lobby');
  const [movableFloorSetting, setMovableFloorSetting] = useState('2nd Floor');
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulatedTime, setSimulatedTime] = useState('11:00');
  
  const [isTouchLocked, setIsTouchLocked] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Form state with unselected room, times, and targets
  const [formData, setFormData] = useState({
    title: '',
    room: '',
    targets: [],
    startTime: '',
    endTime: '',
    headerOverride: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const screenParam = params.get('screen');

    if (modeParam === 'player') setActiveTab('player');
    if (screenParam) setSelectedScreen(screenParam);
  }, []);

  useEffect(() => {
    if (!session) return;
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
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError(error.message);
    }
    setIsLoggingIn(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

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

  const activeEventsForScreen = useMemo(() => {
    return events.filter(evt => {
      const isTargeted = evt.targets.includes(selectedScreen);
      const isWithinTime = simulatedTime >= evt.startTime && simulatedTime <= evt.endTime;
      return isTargeted && isWithinTime;
    }).slice(0, 4);
  }, [events, selectedScreen, simulatedTime]);

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
    if (!formData.title || !formData.room || !formData.startTime || !formData.endTime) {
      alert('Please select a meeting room, start time, and end time.');
      return;
    }

    if (formData.targets.length === 0) {
      alert('Please select at least one Target Display.');
      return;
    }
    
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
      room: '',
      targets: [],
      startTime: '',
      endTime: '',
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

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Checking authentication session...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 font-sans select-none">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-block bg-amber-500 text-slate-950 px-4 py-1.5 rounded-lg font-serif font-extrabold text-2xl tracking-widest shadow-lg">
              voco
            </div>
            <h2 className="text-xl font-bold text-slate-100 tracking-wide">Signage CMS Login</h2>
            <p className="text-xs text-slate-400">Beirut Central District Portal</p>
          </div>

          {loginError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center space-x-2 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5">Email Address</label>
              <input
                type="email"
                required
                placeholder="staff@voco.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition text-sm shadow-lg flex items-center justify-center space-x-2"
            >
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
            </button>
          </form>

          <div className="text-center border-t border-slate-800 pt-4">
            <p className="text-[11px] text-slate-500">
              User accounts are managed centrally by the Administrator via Supabase Auth.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full bg-slate-950 text-slate-100 font-sans flex flex-col ${activeTab === 'player' ? 'h-screen overflow-hidden' : ''}`}>
      {/* Header Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-2 z-50 shrink-0 sticky top-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-serif font-bold text-sm tracking-wider">
              voco
            </div>
            <div>
              <h1 className="font-semibold text-xs md:text-sm text-slate-200">Signage System Controller</h1>
              <p className="text-[10px] text-slate-400">Beirut Central District</p>
            </div>
          </div>

          <div className="flex md:hidden items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('cms')}
              className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                activeTab === 'cms' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              CMS
            </button>
            <button
              onClick={() => setActiveTab('player')}
              className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                activeTab === 'player' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Player
            </button>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('cms')}
            className={`flex items-center space-x-2 px-3 py-1 rounded-md text-xs font-medium transition ${
              activeTab === 'cms' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Staff CMS Admin</span>
          </button>
          <button
            onClick={() => setActiveTab('player')}
            className={`flex items-center space-x-2 px-3 py-1 rounded-md text-xs font-medium transition ${
              activeTab === 'player' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Signage Player Display</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex-1 sm:flex-initial flex items-center justify-between space-x-1.5 text-xs bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Time:</span>
            <input
              type="time"
              value={simulatedTime}
              onChange={(e) => setSimulatedTime(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-amber-400 text-xs px-1.5 py-0.5 rounded focus:outline-none"
            />
          </div>

          <div className="flex-1 sm:flex-initial flex items-center justify-between space-x-1.5 text-xs bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Target:</span>
            <select
              value={selectedScreen}
              onChange={(e) => setSelectedScreen(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs px-1.5 py-0.5 rounded focus:outline-none"
            >
              <option value="gf_lobby">GF Lobby Screen</option>
              <option value="lgf_lobby">LGF Lobby Screen</option>
              <option value="floor_movable">Floor Directional Signage</option>
            </select>
          </div>

          {selectedScreen === 'floor_movable' && (
            <div className="flex-1 sm:flex-initial flex items-center justify-between space-x-1.5 text-xs bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
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

          <button
            onClick={handleSignOut}
            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-950 hover:bg-red-500/10 hover:text-red-400 text-slate-400 border border-slate-800 rounded-md text-xs transition ml-auto"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Staff CMS View */}
      {activeTab === 'cms' && (
        <div className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-semibold text-xs md:text-sm flex items-center space-x-2 text-slate-200">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Schedule New Event</span>
              </h2>
              <span className="text-xs text-emerald-400/80 bg-emerald-400/10 px-2.5 py-1 rounded flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Supabase Live Sync</span>
              </span>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-3 text-xs md:text-sm">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Event Name / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saccal Meeting, Unicef CPD..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 text-xs md:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Meeting Room</label>
                  <select
                    required
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 text-xs md:text-sm"
                  >
                    <option value="" disabled>Select a meeting room...</option>
                    {Object.keys(ROOM_METADATA).map(room => (
                      <option key={room} value={room}>{room} ({ROOM_METADATA[room].floor})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Custom Header Override</label>
                  <input
                    type="text"
                    placeholder="Optional title override"
                    value={formData.headerOverride}
                    onChange={(e) => setFormData({ ...formData, headerOverride: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 text-xs md:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Start Time</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-amber-400 focus:outline-none focus:border-amber-500 text-xs md:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">End Time</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-amber-400 focus:outline-none focus:border-amber-500 text-xs md:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Target Displays</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'gf_lobby', label: 'GF Lobby Display' },
                    { id: 'lgf_lobby', label: 'LGF Lobby Display' },
                    { id: 'floor_movable', label: 'Floor Signage' },
                  ].map(target => (
                    <label key={target.id} className="flex items-center space-x-2 cursor-pointer bg-slate-950 border border-slate-800 p-2.5 rounded-lg hover:border-slate-700 transition">
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
                        className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 bg-slate-950 w-4 h-4"
                      />
                      <span className="text-slate-300 text-xs font-medium">{target.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-lg transition flex items-center justify-center space-x-2 text-xs md:text-sm shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Publish Schedule to Live Displays</span>
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-3 shadow-xl mb-6">
            <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">
              Active Schedules ({events.length})
            </h3>
            {loading ? (
              <p className="text-xs text-slate-500">Syncing with database...</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No events currently scheduled in database.</p>
            ) : (
              <div className="space-y-2">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs md:text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{evt.title}</div>
                      <div className="text-amber-400/90 text-xs">
                        in <span className="font-medium text-slate-300">{evt.room}</span> • ({evt.startTime} - {evt.endTime})
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(evt.id)}
                      className="text-slate-500 hover:text-red-400 p-1.5 transition rounded-lg hover:bg-slate-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signage Player View */}
      {activeTab === 'player' && (
        <div className="flex-1 bg-[#070B19] relative overflow-hidden flex flex-col w-full h-full p-4 md:p-6">
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

function SignageCanvas({
  selectedScreen,
  movableFloorSetting,
  activeEvents,
  headerTitle,
  isTouchLocked,
  onCornerTap
}) {
  const eventCount = activeEvents.length;

  const headerSizeMap = {
    1: 'text-4xl md:text-6xl font-extrabold',
    2: 'text-3xl md:text-5xl font-bold',
    3: 'text-2xl md:text-4xl font-bold',
    4: 'text-xl md:text-3xl font-bold',
  };

  const headerSubSizeMap = {
    1: 'text-base md:text-xl font-semibold',
    2: 'text-sm md:text-base font-semibold',
    3: 'text-xs md:text-sm font-semibold',
    4: 'text-[11px] md:text-xs font-semibold',
  };

  const currentHeaderClass = headerSizeMap[eventCount] || headerSizeMap[4];
  const currentSubHeaderClass = headerSubSizeMap[eventCount] || headerSubSizeMap[4];

  if (eventCount === 0) {
    return (
      <div 
        className={`w-full h-full bg-slate-950 relative flex flex-col items-center justify-center p-6 overflow-hidden select-none ${
          isTouchLocked ? 'pointer-events-auto' : ''
        }`}
      >
        <div
          onClick={onCornerTap}
          className="aria-hidden:true absolute top-0 right-0 w-24 h-24 z-50 cursor-default"
        />

        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 opacity-90" />
        <div className="relative z-10 text-center space-y-4">
          <div className="inline-block bg-amber-400/10 border border-amber-400/30 text-amber-400 font-serif text-4xl md:text-6xl px-10 py-3 rounded-2xl tracking-widest shadow-2xl">
            voco
          </div>
          <h2 className="text-xl md:text-3xl font-serif text-slate-300 tracking-wide">Beirut Central District</h2>
          <p className="text-xs md:text-base text-slate-500 animate-pulse">Playing Hotel Promo Video Loop...</p>
        </div>

        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center">
          <div className="text-center font-serif text-sm md:text-lg text-slate-400 tracking-widest border-t border-slate-800/80 pt-3 px-8">
            <span className="text-amber-400 font-bold">VOCO</span> BEIRUT CENTRAL DISTRICT
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`w-full h-full bg-[#070B19] text-white flex flex-col justify-between relative overflow-hidden select-none font-serif ${
        isTouchLocked ? 'pointer-events-none' : ''
      }`}
    >
      <div
        onClick={onCornerTap}
        className="pointer-events-auto absolute top-0 right-0 w-24 h-24 z-50 cursor-default"
      />

      <div className="text-center space-y-1 shrink-0 pb-2">
        <div className={`flex items-center justify-center space-x-3 text-amber-400/90 uppercase font-sans tracking-widest ${currentSubHeaderClass}`}>
          <span className="h-[1px] w-12 md:w-24 bg-amber-400/40" />
          <span>How To Get To</span>
          <span className="h-[1px] w-12 md:w-24 bg-amber-400/40" />
        </div>
        <h1 className={`text-white tracking-wide leading-tight line-clamp-1 px-2 transition-all duration-300 ${currentHeaderClass}`}>
          {headerTitle}
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 py-2 w-full">
        {selectedScreen === 'floor_movable' ? (
          <FloorAxisLayout movableFloorSetting={movableFloorSetting} events={activeEvents} />
        ) : (
          <DynamicLobbyLayout screenType={selectedScreen} events={activeEvents} />
        )}
      </div>

      <div className="text-center shrink-0 border-t border-amber-400/20 pt-2">
        <div className="inline-flex items-center space-x-3 text-xs md:text-base text-slate-300 tracking-widest font-sans">
          <span className="font-serif font-bold text-amber-400 text-sm md:text-lg">voco</span>
          <span className="text-slate-400">|</span>
          <span>Beirut Central District</span>
        </div>
      </div>
    </div>
  );
}

function DynamicLobbyLayout({ screenType, events }) {
  const originBadge = screenType === 'lgf_lobby' ? 'LGF' : 'GF';
  const count = events.length;

  const sizeMap = {
    1: {
      cardPadding: 'p-6 md:p-10',
      badgeText: 'text-2xl md:text-4xl px-6 py-4',
      arrowBox: 'text-base md:text-xl border-2 px-3 py-1',
      arrowText: 'text-lg md:text-2xl',
      arrowIcon: 'w-8 h-8 md:w-10 md:h-10',
      targetWidth: 'w-72 md:w-96 p-4 md:p-6',
      floorText: 'text-base md:text-xl',
      titleText: 'text-3xl md:text-5xl my-2',
      roomText: 'text-base md:text-xl',
      spacing: 'space-y-0',
    },
    2: {
      cardPadding: 'p-4 md:p-6',
      badgeText: 'text-xl md:text-3xl px-5 py-3',
      arrowBox: 'text-sm md:text-lg border-2 px-2.5 py-0.5',
      arrowText: 'text-sm md:text-lg',
      arrowIcon: 'w-6 h-6 md:w-8 md:h-8',
      targetWidth: 'w-60 md:w-80 p-3 md:p-4',
      floorText: 'text-sm md:text-base',
      titleText: 'text-2xl md:text-3xl my-1',
      roomText: 'text-sm md:text-base',
      spacing: 'space-y-4 md:space-y-6',
    },
    3: {
      cardPadding: 'p-3 md:p-4',
      badgeText: 'text-base md:text-xl px-4 py-2',
      arrowBox: 'text-xs md:text-sm border px-2 py-0.5',
      arrowText: 'text-xs md:text-base',
      arrowIcon: 'w-5 h-5 md:w-6 md:h-6',
      targetWidth: 'w-48 md:w-64 p-2 md:p-3',
      floorText: 'text-xs md:text-sm',
      titleText: 'text-lg md:text-2xl my-0.5',
      roomText: 'text-xs md:text-sm',
      spacing: 'space-y-3 md:space-y-4',
    },
    4: {
      cardPadding: 'p-2 md:p-3',
      badgeText: 'text-sm md:text-base px-3 py-1.5',
      arrowBox: 'text-[10px] md:text-xs border px-1.5 py-0.5',
      arrowText: 'text-[11px] md:text-xs',
      arrowIcon: 'w-4 h-4 md:w-5 md:h-5',
      targetWidth: 'w-40 md:w-52 p-2',
      floorText: 'text-[10px] md:text-xs',
      titleText: 'text-sm md:text-lg my-0.5',
      roomText: 'text-[10px] md:text-xs',
      spacing: 'space-y-2 md:space-y-3',
    },
  };

  const currentSize = sizeMap[count] || sizeMap[4];

  return (
    <div className={`w-full max-w-5xl h-full flex flex-col justify-center ${currentSize.spacing} py-1 px-2`}>
      {events.map((evt) => {
        const roomMeta = ROOM_METADATA[evt.room] || { floorCode: '1st' };
        const isFirstFloor = roomMeta.floorCode === '1st';

        return (
          <div 
            key={evt.id} 
            className={`flex items-center justify-between space-x-3 md:space-x-4 bg-[#0A1022]/90 border border-amber-400/40 rounded-xl ${currentSize.cardPadding} shadow-xl transition-all duration-300`}
          >
            <div className={`bg-amber-400 text-slate-950 font-sans font-extrabold rounded-lg shadow shrink-0 ${currentSize.badgeText}`}>
              {originBadge}
            </div>

            <div className="flex-1 flex items-center space-x-2 text-amber-400 font-sans min-w-0">
              <div className={`border-amber-400/60 rounded-md shrink-0 ${currentSize.arrowBox}`}>
                <span className="font-mono font-bold">↑↓</span>
              </div>
              <div className={`flex-1 border-t border-amber-400/40 flex items-center justify-between font-semibold px-2 truncate ${currentSize.arrowText}`}>
                <span className="truncate">{isFirstFloor ? 'STAIRS OR ELEVATOR' : 'ELEVATOR TO'}</span>
                <ArrowRight className={`text-amber-400 shrink-0 ml-1 ${currentSize.arrowIcon}`} />
              </div>
            </div>

            <div className={`bg-[#0C142A] border border-amber-400/80 rounded-xl text-center shadow-lg shrink-0 overflow-hidden ${currentSize.targetWidth}`}>
              <div className={`text-amber-400 font-serif font-bold uppercase tracking-wider ${currentSize.floorText}`}>
                {roomMeta.floorCode} Floor
              </div>
              <div className={`text-white font-serif font-bold leading-tight truncate ${currentSize.titleText}`}>
                {evt.title}
              </div>
              <div className={`text-amber-300/90 font-serif italic truncate ${currentSize.roomText}`}>
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
    <div className="w-full max-w-5xl space-y-4 px-2">
      <div className="relative flex items-center justify-between my-2">
        <div className="absolute inset-x-0 top-1/2 h-[2px] bg-amber-400/80 -translate-y-1/2" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-400 rounded-full" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-400 rounded-full" />

        <div className="relative z-10 mx-auto bg-[#070B19] px-4 text-center space-y-0.5">
          <div className="text-amber-400 font-serif text-lg md:text-2xl font-bold">
            {movableFloorSetting}
          </div>
          <div className="w-3 h-3 bg-amber-400 rounded-full mx-auto shadow-md shadow-amber-400/50" />
          <div className="text-slate-300 font-sans text-xs tracking-wider flex items-center justify-center space-x-1 pt-0.5">
            <span>← You are here</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 pt-1">
        <div className="space-y-3">
          {leftEvents.map(evt => (
            <div key={evt.id} className="flex items-center space-x-3 bg-[#0C142A] border border-amber-400/40 p-3 rounded-xl shadow-lg">
              <ArrowLeft className="w-6 h-6 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-white font-serif text-sm md:text-xl font-bold truncate">{evt.title}</div>
                <div className="text-amber-400 font-serif text-xs md:text-sm italic truncate">in {evt.room}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 text-right">
          {rightEvents.map(evt => (
            <div key={evt.id} className="flex items-center justify-end space-x-3 bg-[#0C142A] border border-amber-400/40 p-3 rounded-xl shadow-lg">
              <div className="min-w-0">
                <div className="text-white font-serif text-sm md:text-xl font-bold truncate">{evt.title}</div>
                <div className="text-amber-400 font-serif text-xs md:text-sm italic truncate">in {evt.room}</div>
              </div>
              <ArrowRight className="w-6 h-6 text-amber-400 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}