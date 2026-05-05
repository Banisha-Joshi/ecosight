import React, { useState, useEffect } from 'react';
import { 
  Leaf, Droplets, Sun, Fish, AlertTriangle, 
  Activity, Info, Wind, Thermometer, TestTube,
  BarChart3, ShieldAlert, CheckCircle, Save, Users, Download
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// --- FIREBASE SETUP ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- DATA SCIENCE ENGINE ---
const calculateEcosystemHealth = (features) => {
  const { temperature, ph, nutrients, biodiversity, algae } = features;
  
  let score = 100;
  let risks = [];
  let insights = [];

  if (temperature > 25) {
    const penalty = (temperature - 25) * 2;
    score -= penalty;
    risks.push({ level: temperature > 28 ? 'High' : 'Medium', type: 'Thermal Stress', msg: 'Elevated temperatures reduce dissolved oxygen, threatening aquatic life.' });
  } else if (temperature < 15) {
    score -= (15 - temperature);
    insights.push('Sub-optimal temperature for maximum biological productivity.');
  }

  if (ph < 6.5) {
    score -= (6.5 - ph) * 15;
    risks.push({ level: ph < 5.5 ? 'High' : 'Medium', type: 'Acidification', msg: 'Acidic water dissolves fish gills and damages crustacean shells.' });
  } else if (ph > 8.5) {
    score -= (ph - 8.5) * 10;
    risks.push({ level: 'Medium', type: 'Alkalinity Stress', msg: 'High pH can increase the toxicity of chemicals like ammonia.' });
  }

  if (nutrients > 2.0) {
    score -= (nutrients - 2.0) * 8;
    if (nutrients > 4.0) {
      risks.push({ level: 'High', type: 'Nutrient Overload', msg: 'Excessive agricultural runoff detected. Major driver of eutrophication.' });
    }
  }

  if (algae > 15) {
    score -= (algae - 15) * 1.5;
    if (algae > 30 && nutrients > 3.0 && temperature > 20) {
      risks.push({ level: 'Critical', type: 'Harmful Algal Bloom (HAB)', msg: 'Synergistic effect of high heat, nutrients, and algae. Severe oxygen depletion imminent.' });
    } else if (algae > 25) {
      risks.push({ level: 'High', type: 'Algal Bloom', msg: 'Overgrowth of algae blocking sunlight for benthic plants.' });
    }
  }

  if (biodiversity < 0.7) {
    score -= (0.7 - biodiversity) * 40;
    risks.push({ level: biodiversity < 0.4 ? 'High' : 'Medium', type: 'Low Resilience', msg: 'Low biodiversity makes the ecosystem highly vulnerable to diseases and invasive species.' });
  } else {
    insights.push('High biodiversity is acting as a buffer against environmental shocks.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let status = 'Healthy';
  let color = 'text-green-500';
  let bgColor = 'bg-green-100';
  
  if (score < 40) {
    status = 'Critical';
    color = 'text-red-600';
    bgColor = 'bg-red-100';
  } else if (score < 75) {
    status = 'Vulnerable';
    color = 'text-yellow-600';
    bgColor = 'bg-yellow-100';
  }

  return { score, status, color, bgColor, risks, insights };
};

// --- REACT UI COMPONENTS ---
const App = () => {
  const [activeTab, setActiveTab] = useState('learn');
  const [user, setUser] = useState(null);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [scenarioName, setScenarioName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [features, setFeatures] = useState({
    temperature: 20,
    ph: 7.2,
    nutrients: 1.5,
    biodiversity: 0.8,
    algae: 10
  });

  const [analysis, setAnalysis] = useState(calculateEcosystemHealth(features));

  // 1. Initialize Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Fetch Community Scenarios from Firestore
  useEffect(() => {
    if (!user) return;
    
    const scenariosRef = collection(db, 'artifacts', appId, 'public', 'data', 'scenarios');
    
    const unsubscribe = onSnapshot(scenariosRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually in memory to avoid complex queries
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setSavedScenarios(data);
    }, (error) => {
      console.error("Error fetching scenarios:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Update analysis on feature change
  useEffect(() => {
    setAnalysis(calculateEcosystemHealth(features));
  }, [features]);

  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    setFeatures(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  const handleSaveScenario = async () => {
    if (!user || !scenarioName.trim()) return;
    setIsSaving(true);
    
    try {
      const scenariosRef = collection(db, 'artifacts', appId, 'public', 'data', 'scenarios');
      await addDoc(scenariosRef, {
        name: scenarioName,
        features: features,
        score: analysis.score,
        status: analysis.status,
        createdAt: serverTimestamp(),
        userId: user.uid
      });
      setScenarioName('');
    } catch (error) {
      console.error("Error saving scenario:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadScenario = (scenarioFeatures) => {
    setFeatures(scenarioFeatures);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-teal-200">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between sm:h-16 py-3 sm:py-0">
            <div className="flex items-center justify-center sm:justify-start mb-3 sm:mb-0">
              <Leaf className="h-8 w-8 text-teal-600" />
              <span className="ml-2 text-xl font-bold tracking-tight text-slate-900">EcoSight <span className="text-teal-600">Analytics</span></span>
            </div>
            <div className="flex space-x-1 items-center justify-center overflow-x-auto">
              <button 
                onClick={() => setActiveTab('learn')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'learn' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                1. Learn
              </button>
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                2. Data Simulator
              </button>
              <button 
                onClick={() => setActiveTab('community')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center ${activeTab === 'community' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Users className="h-4 w-4 mr-1" /> 3. Community DB
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- LEARN SECTION --- */}
        {activeTab === 'learn' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-4xl mx-auto mb-12 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-6 text-center">Welcome to EcoSight: Your Ecosystem Simulator</h1>
              
              <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
                <p>
                  Have you ever wondered what happens to a lake when the water gets too warm, or when too much fertilizer washes into it? <strong>EcoSight</strong> is built to help you find out! The purpose of this website is to make the complex science of nature easy to understand for everyone.
                </p>
                
                <p>
                  To get started, you need to know one key concept: an <strong>Ecosystem</strong> is simply a community where living things interact with their physical surroundings. Everything in an ecosystem is connected, and we divide these connections into two main categories: <strong>Abiotic</strong> (the non-living environment) and <strong>Biotic</strong> (the living creatures).
                </p>

                <div className="bg-teal-50 border-l-4 border-teal-500 p-5 mt-6 rounded-r-lg">
                  <h3 className="font-bold text-teal-900 mb-2">How to use this website:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-teal-800 text-base">
                    <li>Read through the cards below to understand the basic building blocks.</li>
                    <li>Click the <strong>"Data Simulator"</strong> tab at the top.</li>
                    <li>Act like a scientist! Move the sliders to change things like temperature or pollution, and watch how it impacts the "Overall Health Score".</li>
                    <li>Save your scenario to the <strong>"Community DB"</strong> to share your simulated environment with others!</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Abiotic Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center">
                  <Wind className="h-6 w-6 text-blue-600 mr-2" />
                  <h2 className="text-xl font-bold text-blue-900">Abiotic (Non-Living)</h2>
                </div>
                <div className="p-6">
                  <p className="text-slate-600 mb-4">The physical and chemical parts of the environment. Think of these as the "living conditions."</p>
                  <ul className="space-y-3 text-slate-700">
                    <li className="flex items-start"><Thermometer className="h-5 w-5 text-blue-500 mr-2 mt-0.5 shrink-0" /> <div><strong>Temperature:</strong> Water that is too hot holds less oxygen, which makes it hard for fish to breathe.</div></li>
                    <li className="flex items-start"><TestTube className="h-5 w-5 text-blue-500 mr-2 mt-0.5 shrink-0" /> <div><strong>pH Level:</strong> Measures how acidic the water is. If it's too acidic, it can dissolve the shells of small creatures.</div></li>
                    <li className="flex items-start"><Droplets className="h-5 w-5 text-blue-500 mr-2 mt-0.5 shrink-0" /> <div><strong>Nutrients:</strong> Things like fertilizer (Nitrates). A little is good, but too much acts like junk food for the lake, causing massive weed growth.</div></li>
                  </ul>
                </div>
              </div>

              {/* Biotic Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center">
                  <Fish className="h-6 w-6 text-emerald-600 mr-2" />
                  <h2 className="text-xl font-bold text-emerald-900">Biotic (Living)</h2>
                </div>
                <div className="p-6">
                  <p className="text-slate-600 mb-4">All the living organisms within the ecosystem, from tiny bacteria to big fish.</p>
                  <ul className="space-y-3 text-slate-700">
                    <li className="flex items-start"><Leaf className="h-5 w-5 text-emerald-500 mr-2 mt-0.5 shrink-0" /> <div><strong>Algae:</strong> Tiny plants in the water. If they grow out of control (an Algal Bloom), they block sunlight and suffocate the lake.</div></li>
                    <li className="flex items-start"><Activity className="h-5 w-5 text-emerald-500 mr-2 mt-0.5 shrink-0" /> <div><strong>Biodiversity:</strong> This means having many <em>different</em> types of species. High biodiversity is like a strong immune system for the lake.</div></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- DATA SIMULATOR DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">Ecosystem Simulator</h1>
              <p className="text-slate-600 mt-2">
                Adjust the sliders below. Our science engine will instantly predict how your changes affect the lake's health.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
              {/* Left Column: Input Features */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center mb-6">
                    <BarChart3 className="h-5 w-5 mr-2 text-teal-600" />
                    Environment Controls
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Abiotic (Non-Living)</h3>
                      
                      {/* Temp Slider */}
                      <div className="mb-4">
                        <div className="flex justify-between mb-1">
                          <label className="text-sm font-medium text-slate-700">Water Temp (°C)</label>
                          <span className="text-sm text-slate-500 font-mono">{features.temperature}°C</span>
                        </div>
                        <input 
                          type="range" name="temperature" min="5" max="35" step="0.5" 
                          value={features.temperature} onChange={handleSliderChange}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      {/* pH Slider */}
                      <div className="mb-4">
                        <div className="flex justify-between mb-1">
                          <label className="text-sm font-medium text-slate-700">pH Level</label>
                          <span className="text-sm text-slate-500 font-mono">{features.ph}</span>
                        </div>
                        <input 
                          type="range" name="ph" min="4" max="10" step="0.1" 
                          value={features.ph} onChange={handleSliderChange}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      {/* Nutrients Slider */}
                      <div className="mb-4">
                        <div className="flex justify-between mb-1">
                          <label className="text-sm font-medium text-slate-700">Nutrients / Pollution (ppm)</label>
                          <span className="text-sm text-slate-500 font-mono">{features.nutrients} ppm</span>
                        </div>
                        <input 
                          type="range" name="nutrients" min="0" max="8" step="0.1" 
                          value={features.nutrients} onChange={handleSliderChange}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Biotic (Living)</h3>
                      
                      {/* Algae Slider */}
                      <div className="mb-4">
                        <div className="flex justify-between mb-1">
                          <label className="text-sm font-medium text-slate-700">Algae Amount (ug/L)</label>
                          <span className="text-sm text-slate-500 font-mono">{features.algae}</span>
                        </div>
                        <input 
                          type="range" name="algae" min="0" max="50" step="1" 
                          value={features.algae} onChange={handleSliderChange}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      {/* Biodiversity Slider */}
                      <div className="mb-4">
                        <div className="flex justify-between mb-1">
                          <label className="text-sm font-medium text-slate-700">Biodiversity (Variety of Life)</label>
                          <span className="text-sm text-slate-500 font-mono">{features.biodiversity}</span>
                        </div>
                        <input 
                          type="range" name="biodiversity" min="0.1" max="1.0" step="0.05" 
                          value={features.biodiversity} onChange={handleSliderChange}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Save to DB Section */}
                  <div className="mt-8 pt-6 border-t border-slate-200 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
                      <Save className="h-4 w-4 mr-2 text-slate-500"/> Share to Community Database
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">Found an interesting combination? Save it so others can learn from it.</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="e.g., Summer Heatwave 2026" 
                        value={scenarioName}
                        onChange={(e) => setScenarioName(e.target.value)}
                        className="flex-1 text-sm rounded-md border-slate-300 border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button 
                        onClick={handleSaveScenario}
                        disabled={isSaving || !scenarioName.trim() || !user}
                        className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Analytics & Predictions */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Score Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center sm:justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Overall Health Score</h2>
                    <p className="text-sm text-slate-500 mt-1">100 is perfect. Below 40 is critical danger.</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${analysis.color}`}>{analysis.status}</div>
                    </div>
                    
                    <div className="relative w-24 h-24">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                        <circle 
                          cx="50" cy="50" r="45" fill="none" 
                          stroke={analysis.score > 75 ? '#22c55e' : analysis.score > 40 ? '#eab308' : '#ef4444'} 
                          strokeWidth="10" strokeDasharray="283" strokeDashoffset={283 - (283 * analysis.score) / 100}
                          strokeLinecap="round" transform="rotate(-90 50 50)"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-slate-800">{analysis.score}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Predictive Alerts */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[200px]">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                    <ShieldAlert className="h-5 w-5 mr-2 text-slate-600" />
                    Danger Alerts
                  </h2>
                  
                  {analysis.risks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                      <p className="text-slate-600 font-medium">The ecosystem is safe and balanced.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analysis.risks.map((risk, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border ${risk.level === 'Critical' ? 'bg-red-50 border-red-200' : risk.level === 'High' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                          <div className="flex items-start">
                            <AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 ${risk.level === 'Critical' ? 'text-red-600' : risk.level === 'High' ? 'text-orange-600' : 'text-yellow-600'}`} />
                            <div>
                              <h4 className={`font-bold ${risk.level === 'Critical' ? 'text-red-900' : risk.level === 'High' ? 'text-orange-900' : 'text-yellow-900'}`}>
                                {risk.type} <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-white bg-opacity-50 ml-2">{risk.level}</span>
                              </h4>
                              <p className={`text-sm mt-1 ${risk.level === 'Critical' ? 'text-red-800' : risk.level === 'High' ? 'text-orange-800' : 'text-yellow-800'}`}>
                                {risk.msg}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- COMMUNITY DB SECTION --- */}
        {activeTab === 'community' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-slate-900 flex justify-center items-center">
                <Users className="h-8 w-8 mr-3 text-teal-600"/> Community Scenarios
              </h1>
              <p className="text-slate-600 mt-2">
                Explore hypothetical ecosystems built by other users. Load them into your simulator to see how they function!
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {savedScenarios.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <p>No scenarios saved yet. Be the first to create one in the Data Simulator!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {savedScenarios.map((scenario) => (
                    <div key={scenario.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800">{scenario.name}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${scenario.score > 75 ? 'bg-green-100 text-green-800' : scenario.score > 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            Score: {scenario.score} ({scenario.status})
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                            Temp: {scenario.features.temperature}°C
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                            Nutrients: {scenario.features.nutrients} ppm
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => loadScenario(scenario.features)}
                        className="flex items-center text-sm bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 px-4 py-2 rounded-md transition-colors w-full sm:w-auto justify-center"
                      >
                        <Download className="h-4 w-4 mr-2" /> Load to Simulator
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            Powered by Firebase Firestore Cloud Database.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;