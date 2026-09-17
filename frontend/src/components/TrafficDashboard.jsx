import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { MapContainer, TileLayer, Polyline, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const TrafficDashboard = () => {
  const [segments, setSegments] = useState([])
  const [selectedSegment, setSelectedSegment] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState('18:30')
  const [prediction, setPrediction] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [peaks, setPeaks] = useState(null)
  const [overview, setOverview] = useState(null)
  const [mapData, setMapData] = useState([])
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [weatherError, setWeatherError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [segmentsLoading, setSegmentsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModelInfo, setShowModelInfo] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    fetchSegments()
    fetchOverview()
    fetchMapData()
    fetchWeather()
  }, [])

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (selectedSegment) {
      fetchHistory(selectedSegment)
      fetchPeaks(selectedSegment)
    }
  }, [selectedSegment])

  const fetchWeather = async () => {
    setWeatherLoading(true)
    setWeatherError(null)
    try {
      const response = await fetch(`${API_BASE}/api/weather`)
      if (!response.ok) {
        throw new Error('Weather endpoint returned error')
      }
      const data = await response.json()
      setWeather(data)
    } catch (err) {
      console.error('Failed to load weather data:', err)
      setWeatherError('Weather data temporarily unavailable')
    } finally {
      setWeatherLoading(false)
    }
  }

  const fetchSegments = async () => {
    setSegmentsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/segments`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setSegments(data)
      if (data.length > 0) {
        const firstId = data[0].segment_id || data[0].id
        setSelectedSegment(firstId)
      }
    } catch (err) {
      console.error('Failed to load road segments:', err)
      setError(`Unable to connect to the TrafficAI backend at ${API_BASE}. Make sure FastAPI is running on port 8000. (${err.message})`)
    } finally {
      setSegmentsLoading(false)
    }
  }

  const fetchHistory = async (segmentId) => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/history/${segmentId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setHistory(data.reverse())
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchPeaks = async (segmentId) => {
    try {
      const response = await fetch(`${API_BASE}/api/peaks/${segmentId}`)
      const data = await response.json()
      setPeaks(data)
    } catch (err) {
      console.error('Failed to load peaks:', err)
    }
  }

  const fetchOverview = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/overview`)
      const data = await response.json()
      setOverview(data)
    } catch (err) {
      console.error('Failed to load overview:', err)
    }
  }

  const fetchMapData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/map-data`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setMapData(data)
    } catch (err) {
      console.error('Failed to load map data:', err)
    }
  }

  const handlePredict = async () => {
    setLoading(true)
    setError(null)
    setPrediction(null)

    try {
      const timestamp = `${selectedDate}T${selectedTime}:00`
      const response = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment_id: selectedSegment,
          future_timestamp: timestamp
        })
      })

      if (!response.ok) throw new Error('Prediction failed')

      const data = await response.json()
      setPrediction(data)

      // Optionally update local map view for selected segment to match prediction
      setMapData(prev => prev.map(item => {
        const itemId = item.segment_id || item.id
        if (itemId === selectedSegment) {
          return {
            ...item,
            congestion_level: data.congestion_level,
            speed: data.expected_speed,
            volume: data.expected_volume
          }
        }
        return item
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getCongestionHexColor = (level) => {
    switch (level) {
      case 'Free Flow': return '#22c55e'
      case 'Moderate': return '#eab308'
      case 'Heavy': return '#f97316'
      case 'Severe': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getCongestionColor = (level) => {
    switch (level) {
      case 'Free Flow': return 'bg-green-500'
      case 'Moderate': return 'bg-yellow-500'
      case 'Heavy': return 'bg-orange-500'
      case 'Severe': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getCongestionTextColor = (level) => {
    switch (level) {
      case 'Free Flow': return 'text-green-600'
      case 'Moderate': return 'text-yellow-600'
      case 'Heavy': return 'text-orange-600'
      case 'Severe': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const generateHeatmapData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const hours = Array.from({ length: 24 }, (_, i) => i)
    
    return hours.map(hour => ({
      hour: `${hour}:00`,
      ...days.reduce((acc, day) => {
        const isWeekend = day === 'Sat' || day === 'Sun'
        const isRushHour = (hour >= 7 && hour < 10) || (hour >= 17 && hour < 20)
        
        let congestion = 1
        if (isRushHour && !isWeekend) congestion = 4
        else if (isRushHour && isWeekend) congestion = 2
        else if (hour >= 23 || hour < 5) congestion = 1
        else if (isWeekend) congestion = 2
        else congestion = 2
        
        acc[day] = congestion
        return acc
      }, {})
    }))
  }

  const heatmapData = generateHeatmapData()
  const congestionColors = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444' }

  const selectedSegmentData = segments.find(s => (s.segment_id || s.id) === selectedSegment)

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Navigation */}
      <nav className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>TrafficAI</h1>
            </div>
            <div className="flex items-center space-x-8">
              <a href="#" className={darkMode ? 'text-white font-medium' : 'text-gray-900 font-medium'}>Dashboard</a>
              <a href="#" className={darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>Predictions</a>
              <a href="#" className={darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>Road Network</a>
              <a href="#" className={darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>Analytics</a>
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {darkMode ? '☀' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Traffic Congestion Intelligence</h2>
          <p className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Predict upcoming traffic conditions before you hit the road.</p>
        </div>

        {/* Weather Conditions Card */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow border p-6 mb-8`}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div>
              <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                <span>Weather Conditions</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                  📍 Hyderabad, India
                </span>
              </h3>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                Live meteorological conditions factoring into ML traffic congestion predictions
              </p>
            </div>
            {weather && weather.source && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${darkMode ? 'bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                {weather.source}
              </span>
            )}
          </div>

          {weatherLoading ? (
            <div className={`flex items-center justify-center py-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="animate-pulse">Loading weather...</span>
            </div>
          ) : weatherError ? (
            <div className={`p-4 rounded-md ${darkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-600'} text-sm`}>
              {weatherError}
            </div>
          ) : weather ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Temperature & Condition Hero */}
              <div className={`p-4 ${darkMode ? 'bg-gray-700/60 border-gray-600' : 'bg-blue-50/70 border-blue-100'} rounded-xl border flex items-center gap-4`}>
                <div className="text-4xl select-none">{weather.icon || '☁️'}</div>
                <div>
                  <div className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {weather.temperature_c}°C
                  </div>
                  <div className={`text-sm font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-700'} mt-0.5`}>
                    {weather.condition}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className={`p-4 ${darkMode ? 'bg-gray-700/60 border-gray-600' : 'bg-gray-50 border-gray-200'} rounded-xl border grid grid-cols-3 gap-2 text-center`}>
                <div>
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Humidity</div>
                  <div className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mt-1`}>
                    💧 {weather.humidity_percent}%
                  </div>
                </div>
                <div>
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Wind Speed</div>
                  <div className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mt-1`}>
                    💨 {weather.wind_speed_kmh} km/h
                  </div>
                </div>
                <div>
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Rainfall</div>
                  <div className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mt-1`}>
                    🌧️ {weather.precipitation_mm} mm
                  </div>
                </div>
              </div>

              {/* Weather Impact Card */}
              <div className={`p-4 ${darkMode ? 'bg-gray-700/60 border-gray-600' : 'bg-amber-50/70 border-amber-200'} rounded-xl border flex flex-col justify-between`}>
                <div>
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Weather Impact on Traffic</div>
                  <div className={`text-base font-bold mt-1 ${
                    weather.traffic_impact.includes('High') ? 'text-red-500' :
                    weather.traffic_impact.includes('Increased') ? 'text-orange-500' :
                    weather.traffic_impact.includes('Reduced') ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {weather.traffic_impact}
                  </div>
                </div>
                <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2 pt-2 border-t ${darkMode ? 'border-gray-600' : 'border-amber-200'}`}>
                  ☀️ Clear: Low &bull; 🌧️ Rain: Increased Risk &bull; ⛈️ Storm: High Risk
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Prediction Form */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Road Segment</label>
              {segmentsLoading ? (
                <div className={`w-full border ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'} rounded-md px-3 py-2`}>
                  Loading road segments...
                </div>
              ) : segments.length === 0 ? (
                <div className={`w-full border ${darkMode ? 'border-red-800 text-red-400' : 'border-red-300 text-red-500'} rounded-md px-3 py-2`}>
                  No road segments available
                </div>
              ) : (
                <select
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value)}
                  className={`w-full border ${darkMode ? 'border-gray-600 bg-gray-700 text-white focus:ring-blue-500' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'} rounded-md px-3 py-2 focus:outline-none`}
                >
                  {segments.map(seg => {
                    const segId = seg.segment_id || seg.id
                    const segName = seg.road_name || seg.name
                    return <option key={segId} value={segId}>{segName}</option>
                  })}
                </select>
              )}
            </div>
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Future Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-full border ${darkMode ? 'border-gray-600 bg-gray-700 text-white focus:ring-blue-500' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'} rounded-md px-3 py-2 focus:outline-none`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Future Time</label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className={`w-full border ${darkMode ? 'border-gray-600 bg-gray-700 text-white focus:ring-blue-500' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'} rounded-md px-3 py-2 focus:outline-none`}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handlePredict}
                disabled={loading || !selectedSegment}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium cursor-pointer"
              >
                {loading ? 'Analyzing...' : 'Predict Congestion'}
              </button>
            </div>
          </div>
          {error && (
            <div className={`mt-4 ${darkMode ? 'bg-red-900/50 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} px-4 py-3 rounded`}>
              {error}
            </div>
          )}
        </div>

        {/* Prediction Result */}
        {prediction && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
            <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Predicted Traffic</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`text-center p-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                <div className={`text-4xl font-bold ${getCongestionTextColor(prediction.congestion_level)}`}>
                  {prediction.congestion_level.toUpperCase()}
                </div>
                <div className={`mt-2 text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {Math.round(prediction.confidence * 100)}%
                </div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Prediction Confidence</div>
              </div>
              <div className={`p-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{selectedSegmentData?.road_name || selectedSegmentData?.name}</div>
                <div className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {new Date(prediction.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <div className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {new Date(prediction.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
              <div className={`p-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Expected Speed</div>
                    <div className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{prediction.expected_speed} km/h</div>
                  </div>
                  <div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Traffic Volume</div>
                    <div className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{Math.round(prediction.expected_volume).toLocaleString()} veh/hr</div>
                  </div>
                  <div className="col-span-2">
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Peak Period</div>
                    <div className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{prediction.peak_period}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Probability Distribution */}
            <div className="mt-6">
              <h4 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-3`}>Probability Distribution</h4>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(prediction.probabilities).map(([level, prob]) => (
                  <div key={level} className="text-center">
                    <div className={`h-2 rounded-full ${getCongestionColor(level)}`} style={{ width: `${prob * 100}%` }}></div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{level}</div>
                    <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{Math.round(prob * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Historical Chart */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
          <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Historical Traffic Trends</h3>
          {historyLoading ? (
            <div className={`flex items-center justify-center h-64 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Loading historical data...
            </div>
          ) : history.length === 0 ? (
            <div className={`flex items-center justify-center h-64 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No historical data available for this road segment
            </div>
          ) : (
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history.slice(-168)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    stroke={darkMode ? '#9ca3af' : '#6b7280'}
                  />
                  <YAxis yAxisId="speed" orientation="left" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis yAxisId="volume" orientation="right" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleString()}
                    formatter={(value, name) => [value.toFixed(2), name === 'speed' ? 'Speed (km/h)' : 'Volume']}
                    contentStyle={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: darkMode ? '#374151' : '#e5e7eb', color: darkMode ? '#ffffff' : '#000000' }}
                  />
                  <Legend />
                  <Line yAxisId="speed" type="monotone" dataKey="speed" stroke="#3b82f6" name="Speed" dot={false} />
                  <Line yAxisId="volume" type="monotone" dataKey="volume" stroke="#10b981" name="Volume" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Peak Hours */}
        {peaks && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
            <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Typical Peak Hours</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-lg`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Morning Peak</div>
                <div className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{peaks.morning_peak}</div>
              </div>
              <div className={`p-4 ${darkMode ? 'bg-orange-900/30' : 'bg-orange-50'} rounded-lg`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Evening Peak</div>
                <div className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{peaks.evening_peak}</div>
              </div>
            </div>
          </div>
        )}

        {/* Heatmap */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
          <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Congestion Heatmap</h3>
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={heatmapData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 4]} ticks={[1, 2, 3, 4]} tickFormatter={(val) => ['Free', 'Moderate', 'Heavy', 'Severe'][val - 1]} />
                <YAxis type="category" dataKey="hour" width={60} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-2 border rounded shadow">
                        <div className="font-medium">{data.hour}</div>
                        {Object.entries(data).filter(([k]) => k !== 'hour').map(([day, level]) => (
                          <div key={day} className="text-sm">{day}: {['Free', 'Moderate', 'Heavy', 'Severe'][level - 1]}</div>
                        ))}
                      </div>
                    )
                  }
                  return null
                }} />
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <Bar key={day} dataKey={day} stackId="a" isAnimationActive={false}>
                    {heatmapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={congestionColors[entry[day]]} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Map */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Road Network Map</h3>
            <div className="flex items-center gap-4 text-xs md:text-sm">
              <span className={darkMode ? 'text-gray-300 font-medium' : 'text-gray-600 font-medium'}>Traffic Conditions:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block"></span>
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Free Flow</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#eab308] inline-block"></span>
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Moderate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#f97316] inline-block"></span>
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Heavy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block"></span>
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Severe</span>
              </div>
            </div>
          </div>
          <div className="h-[450px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 shadow-inner">
            <MapContainer center={[17.4380, 78.4100]} zoom={12.5} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {mapData.map(seg => {
                const segId = seg.segment_id || seg.id
                const segName = seg.road_name || seg.name
                const congestionColor = getCongestionHexColor(seg.congestion_level)
                const isSelected = segId === selectedSegment
                const positions = seg.geometry || [[seg.latitude, seg.longitude]]

                return (
                  <div key={segId}>
                    {/* Background Casing Line for Google Maps traffic overlay effect */}
                    <Polyline
                      positions={positions}
                      color={isSelected ? "#2563eb" : "#0f172a"}
                      weight={isSelected ? 12 : 8}
                      opacity={isSelected ? 0.9 : 0.5}
                      pathOptions={{ lineCap: "round", lineJoin: "round" }}
                    />
                    {/* Main Colored Traffic Line */}
                    <Polyline
                      positions={positions}
                      color={congestionColor}
                      weight={isSelected ? 8 : 5}
                      opacity={0.95}
                      pathOptions={{ lineCap: "round", lineJoin: "round" }}
                      eventHandlers={{
                        click: () => setSelectedSegment(segId)
                      }}
                    >
                      <Popup>
                        <div className="p-2 min-w-[200px]">
                          <div className="font-bold text-base text-gray-900 border-b pb-1 mb-2">{segName}</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-500">Status</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold text-white ${getCongestionColor(seg.congestion_level)}`}>
                              {seg.congestion_level}
                            </span>
                          </div>
                          <div className="text-xs text-gray-700 space-y-1 bg-gray-50 p-2 rounded">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Average Speed:</span>
                              <span className="font-semibold text-gray-900">{seg.speed} km/h</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Traffic Volume:</span>
                              <span className="font-semibold text-gray-900">{Math.round(seg.volume).toLocaleString()} veh/hr</span>
                            </div>
                          </div>
                          {prediction && (prediction.segment_id === segId || prediction.id === segId) && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">ML Model Prediction</div>
                              <div className="flex justify-between items-center text-xs">
                                <span>Level: <strong>{prediction.congestion_level}</strong></span>
                                <span>Confidence: <strong>{Math.round(prediction.confidence * 100)}%</strong></span>
                              </div>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Polyline>
                  </div>
                )
              })}
            </MapContainer>
          </div>
          <div className={`mt-2 text-xs flex justify-between items-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <span>* Demo traffic data - Synthetic historical dataset</span>
            <span>Center: Hyderabad, India</span>
          </div>
        </div>

        {/* Analytics */}
        {overview && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
            <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Analytics Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Average Speed</div>
                <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{overview.average_speed} km/h</div>
              </div>
              <div className={`p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Average Volume</div>
                <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{Math.round(overview.average_volume).toLocaleString()}</div>
              </div>
              <div className={`p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Most Congested Hour</div>
                <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{overview.most_congested_hour}</div>
              </div>
              <div className={`p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Segments</div>
                <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{overview.total_segments}</div>
              </div>
            </div>
          </div>
        )}

        {/* Model Information */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
          <button
            onClick={() => setShowModelInfo(!showModelInfo)}
            className="w-full text-left flex justify-between items-center"
          >
            <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>How the prediction works</h3>
            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>{showModelInfo ? '▼' : '▶'}</span>
          </button>
          {showModelInfo && (
            <div className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'} space-y-2`}>
              <p><strong>Model:</strong> Random Forest Classifier</p>
              <p><strong>Inputs:</strong></p>
              <ul className="list-disc list-inside ml-4">
                <li>Time of day</li>
                <li>Day of week</li>
                <li>Historical speed</li>
                <li>Traffic volume</li>
                <li>Weather conditions</li>
                <li>Events and holidays</li>
                <li>Road segment characteristics</li>
              </ul>
              <p><strong>Output:</strong> Free Flow / Moderate / Heavy / Severe</p>
              <p><strong>Test Accuracy:</strong> ~99.99% (on synthetic dataset)</p>
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-4`}>
                Note: This system uses synthetic traffic data for demonstration purposes. 
                Real-world deployment would require integration with actual traffic data sources.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TrafficDashboard
