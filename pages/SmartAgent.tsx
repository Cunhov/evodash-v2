import React, { useState } from 'react';
import { Bot, Smile, Frown, Meh, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { analyzeSentiment } from '../services/geminiService';

const SmartAgent: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [analysis, setAnalysis] = useState<{ sentiment: string; score: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!inputText) return;
    setLoading(true);
    const result = await analyzeSentiment(inputText);
    setAnalysis(result);
    setLoading(false);
  };

  const getSentimentColor = (sentiment: string) => {
    const s = sentiment.toLowerCase();
    if (s.includes('positive')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (s.includes('negative')) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  const getSentimentIcon = (sentiment: string) => {
    const s = sentiment.toLowerCase();
    if (s.includes('positive')) return <Smile size={32} />;
    if (s.includes('negative')) return <Frown size={32} />;
    return <Meh size={32} />;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl border border-white/5 mb-4">
            <Bot size={48} className="text-purple-400" />
        </div>
        <h2 className="text-4xl font-bold text-white">Smart Agent Tools</h2>
        <p className="text-lg text-slate-400">Use Gemini AI to analyze customer messages before you reply.</p>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-6">Sentiment Analyzer</h3>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Customer Message</label>
                <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste a customer message here to analyze their mood..."
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-4 focus:ring-2 focus:ring-purple-500 focus:outline-none transition min-h-[120px]"
                />
            </div>

            <div className="flex justify-end">
                <button 
                    onClick={handleAnalyze}
                    disabled={loading || !inputText}
                    className="bg-white text-slate-900 hover:bg-slate-200 px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50"
                >
                    {loading ? 'Analyzing...' : 'Analyze Tone'}
                    {!loading && <ArrowRight size={18} />}
                </button>
            </div>
        </div>

        {analysis && (
            <div className="mt-8 pt-8 border-t border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={`p-6 rounded-xl border flex items-center justify-between ${getSentimentColor(analysis.sentiment)}`}>
                    <div className="flex items-center gap-4">
                        {getSentimentIcon(analysis.sentiment)}
                        <div>
                            <div className="text-sm font-medium opacity-80 uppercase tracking-widest">Detected Sentiment</div>
                            <div className="text-2xl font-bold capitalize">{analysis.sentiment}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-medium opacity-80">Intensity Score</div>
                        <div className="text-3xl font-bold">{analysis.score}/10</div>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex gap-3">
                        <CheckCircle2 className="text-emerald-500 shrink-0" />
                        <div className="text-sm text-slate-400">
                            <span className="text-slate-200 font-medium block mb-1">Recommended Action</span>
                            {analysis.sentiment.toLowerCase().includes('negative') 
                                ? "Apologize immediately and offer a solution. Keep tone empathetic." 
                                : "Thank the customer for their feedback and suggest related products."}
                        </div>
                     </div>
                     <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex gap-3">
                        <AlertCircle className="text-blue-500 shrink-0" />
                        <div className="text-sm text-slate-400">
                            <span className="text-slate-200 font-medium block mb-1">AI Insight</span>
                            This analysis helps prioritize support tickets based on emotional urgency.
                        </div>
                     </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SmartAgent;
